import { supabase } from '../lib/supabaseClient'
import { configureSyncSender, enqueueSync } from '../lib/syncQueue'

const API_BASE = import.meta?.env?.VITE_API_BASE_URL || '/api'

async function getAuthHeaders() {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (token) return { Authorization: `Bearer ${token}` }
  } catch {
    // unauthenticated
  }
  return {}
}

const DEFAULT_TIMEOUT_MS = 20000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Core fetch wrapper with:
 *  - Bearer auth from the Supabase session
 *  - per-request timeout via AbortController
 *  - one retry with backoff on network errors / 5xx responses
 *  - a typed error carrying `.status` so callers can branch on 401 etc.
 */
async function apiFetch(
  path,
  { method = 'GET', body, headers, timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1 } = {},
) {
  const authHeaders = await getAuthHeaders()
  let lastError

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...(headers || {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timer)

      // Retry transient server errors once.
      if (res.status >= 500 && attempt < retries) {
        lastError = new Error(`Server error: ${res.status}`)
        await sleep(300 * (attempt + 1))
        continue
      }

      if (!res.ok) {
        let detail = ''
        try {
          const data = await res.json()
          detail = data?.detail || data?.message || ''
        } catch {
          // ignore
        }
        const err = new Error(detail || `API request failed: ${res.status} ${res.statusText}`)
        err.status = res.status
        throw err
      }

      // 204 / empty body safety
      const text = await res.text()
      return text ? JSON.parse(text) : {}
    } catch (e) {
      clearTimeout(timer)
      // Don't retry real HTTP errors (they have a status); only network/abort.
      if (e?.status || attempt >= retries) {
        lastError = e
        break
      }
      lastError = e
      await sleep(300 * (attempt + 1))
    }
  }

  throw lastError || new Error('API request failed')
}

// ==================== Detection ====================

export async function startDetection() {
  await apiFetch('/detector/start', { method: 'POST' })
  const topics = await apiFetch('/detector/topics')
  return { topics }
}

export async function stopDetection() {
  await apiFetch('/detector/stop', { method: 'POST' })
  return { ok: true }
}

export async function getDetectorStatus() {
  try {
    return await apiFetch('/detector/status')
  } catch {
    return { running: false, exit_code: null }
  }
}

export async function listDetectedTopics() {
  return apiFetch('/detector/topics')
}

export async function getTopic(topicId) {
  const t = await apiFetch(`/detector/topics/${encodeURIComponent(topicId)}`)
  return {
    ...t,
    detectedConcepts: t.detectedConcepts || [],
    tags: t.tags || [],
    subtopics: t.subtopics || [],
    level: t.level || 'intermediate',
  }
}

// ==================== Learning Content ====================

export async function explainTopic(topicId, opts = {}) {
  const subtopicId = opts?.subtopicId ? String(opts.subtopicId) : null
  const force = !!opts?.force

  if (!subtopicId) throw new Error('subtopicId is required')

  const qs = new URLSearchParams()
  qs.set('subtopic_id', subtopicId)
  if (force) qs.set('force', 'true')

  return apiFetch(`/detector/topics/${encodeURIComponent(topicId)}/explainer?${qs.toString()}`)
}

export async function suggestResources(topicId, opts = {}) {
  const subtopicId = opts?.subtopicId ? String(opts.subtopicId) : null
  const limit = Number.isFinite(opts?.limit) ? opts.limit : 40

  const qs = new URLSearchParams()
  if (subtopicId) qs.set('subtopic_id', subtopicId)
  if (limit) qs.set('limit', String(limit))

  return apiFetch(`/detector/topics/${encodeURIComponent(topicId)}/resources?${qs.toString()}`)
}

// ==================== Quizzes ====================

export async function generateQuiz(topicId, opts = {}) {
  const subtopicId = opts?.subtopicId ? String(opts.subtopicId) : null
  const nQuestions = Number.isFinite(opts?.nQuestions) ? opts.nQuestions : 5
  const force = Boolean(opts?.force)
  const difficulty = opts?.difficulty || 'auto'

  if (!subtopicId) throw new Error('subtopicId is required for quiz generation')

  const qs = new URLSearchParams()
  qs.set('subtopic_id', subtopicId)
  qs.set('n_questions', String(nQuestions))
  qs.set('difficulty', difficulty)
  if (force) qs.set('force', 'true')

  return apiFetch(`/detector/topics/${encodeURIComponent(topicId)}/quiz?${qs.toString()}`)
}

export async function generateQuestions(topicId, opts = {}) {
  const subtopicId = opts?.subtopicId ? String(opts.subtopicId) : null
  const nQuestions = Number.isFinite(opts?.nQuestions) ? opts.nQuestions : 5
  const force = Boolean(opts?.force)
  const difficulty = opts?.difficulty || 'auto'

  if (!subtopicId) throw new Error('subtopicId is required')

  const qs = new URLSearchParams()
  qs.set('subtopic_id', subtopicId)
  qs.set('n_questions', String(nQuestions))
  qs.set('difficulty', difficulty)
  if (force) qs.set('force', 'true')

  return apiFetch(`/detector/topics/${encodeURIComponent(topicId)}/quiz?${qs.toString()}`)
}

export async function getQuizDifficulty(topicId, subtopicId) {
  return apiFetch(`/quiz/difficulty/${encodeURIComponent(topicId)}/${encodeURIComponent(subtopicId)}`)
}

export async function submitQuizAttempt(topicId, { subtopicId, answers, clientTime } = {}) {
  if (!subtopicId) throw new Error('subtopicId is required')
  if (!Array.isArray(answers) || !answers.length) throw new Error('answers is required')

  return apiFetch(`/detector/topics/${encodeURIComponent(topicId)}/quiz/submit`, {
    method: 'POST',
    body: {
      subtopicId,
      answers,
      clientTime: clientTime || new Date().toISOString(),
    },
  })
}

// ==================== Quiz Explanations ====================

export async function getQuizExplanations(topicId, subtopicId) {
  return apiFetch(
    `/detector/topics/${encodeURIComponent(topicId)}/quiz/explanations?subtopic_id=${encodeURIComponent(subtopicId)}`,
  )
}

// ==================== Streaks ====================

export async function getStreaks() {
  return apiFetch('/streaks')
}

// ==================== Analytics & Suggestions ====================

export async function getAnalytics() {
  return apiFetch('/analytics')
}

export async function getSuggestions(force = false) {
  const params = new URLSearchParams()
  if (force) params.set('force', 'true')
  return apiFetch(`/suggestions?${params.toString()}`)
}

// ==================== Timetable ====================

export async function generateTimetable({
  events = [],
  availability = {},
  preferences = {},
  topics = [],
  currentDate = null,
}) {
  return apiFetch('/timetable/generate', {
    method: 'POST',
    body: {
      events,
      availability: {
        weekday_hours: availability.weekdayHours ?? 4,
        weekend_hours: availability.weekendHours ?? 6,
        start_time: availability.startTime ?? '09:00',
        end_time: availability.endTime ?? '21:00',
        excluded_dates: availability.excludedDates ?? [],
      },
      preferences: {
        session_length_minutes: preferences.sessionLengthMinutes ?? 45,
        break_length_minutes: preferences.breakLengthMinutes ?? 15,
        max_sessions_per_day: preferences.maxSessionsPerDay ?? 6,
        max_subjects_per_day: preferences.maxSubjectsPerDay ?? 3,
        buffer_percentage: preferences.bufferPercentage ?? 0.15,
        prefer_morning: preferences.preferMorning ?? true,
      },
      topics: topics.map((t) => ({
        id: t.id,
        subject: t.subject,
        topic: t.topic || t.name || t.title,
        difficulty_score: t.difficultyScore ?? t.difficulty ?? 0.5,
        confidence_score: t.confidenceScore ?? t.confidence ?? 0.5,
        prerequisites: t.prerequisites ?? [],
        estimated_hours: t.estimatedHours ?? 2,
        is_concept_heavy: t.isConceptHeavy ?? false,
      })),
      current_date: currentDate,
    },
  })
}

export async function getSampleTimetable() {
  return apiFetch('/timetable/sample')
}

export async function validateTimetableInputs(params) {
  return apiFetch('/timetable/validate', {
    method: 'POST',
    body: params,
  })
}

// ==================== Concept Graph ====================

export async function getConceptGraph(topicId, options = {}) {
  const { maxDepth = 2, maxChildren = 5, useGemini = true } = options

  const params = new URLSearchParams({
    max_depth: maxDepth.toString(),
    max_children: maxChildren.toString(),
    use_gemini: useGemini.toString(),
  })

  return apiFetch(`/detector/topics/${encodeURIComponent(topicId)}/graph?${params}`)
}

// ==================== Resume Learning ====================

const LAST_VIEWED_KEY = 'ala.lastViewed'

export function saveLastViewedPosition(topicId, position) {
  try {
    const data = JSON.parse(localStorage.getItem(LAST_VIEWED_KEY) || '{}')
    data[topicId] = { ...position, timestamp: Date.now() }
    localStorage.setItem(LAST_VIEWED_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }

  // Durable, deduped sync to Supabase via the write-behind queue.
  enqueueSync(
    { kind: 'settings', lastViewed: JSON.parse(localStorage.getItem(LAST_VIEWED_KEY) || '{}') },
    'settings:lastViewed',
  )
}

export function getLastViewedPosition(topicId) {
  try {
    const data = JSON.parse(localStorage.getItem(LAST_VIEWED_KEY) || '{}')
    return data[topicId] || null
  } catch {
    return null
  }
}

export function getResumeLearningInfo(topicId, topic, progress) {
  if (!topic?.subtopics?.length) {
    return {
      url: `/dashboard/topics/${topicId}`,
      label: 'View Topic',
      type: 'view',
    }
  }

  const slugify = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const subtopics = topic.subtopics.map((t, idx) => ({
    id: slugify(t) || `subtopic-${idx + 1}`,
    title: t,
  }))

  const lastViewed = getLastViewedPosition(topicId)
  if (lastViewed?.module) {
    return {
      url: `/dashboard/topics/${topicId}?module=${lastViewed.module}&step=${lastViewed.step || 'explainer'}`,
      label: 'Continue Learning',
      type: 'continue',
    }
  }

  const moduleCompletion = (state) => {
    const keys = ['explainer', 'resources', 'quiz']
    return keys.filter((k) => !!state?.[k]).length / keys.length
  }

  const ensureModule = (prog, id) =>
    prog[id] || { explainer: false, resources: false, quiz: false }

  let allContentViewed = true
  let firstIncomplete = null

  for (const m of subtopics) {
    const state = ensureModule(progress || {}, m.id)
    const completion = moduleCompletion(state)

    if (completion < 1 && !firstIncomplete) {
      firstIncomplete = m
      if (!state.explainer || !state.resources) {
        allContentViewed = false
      }
    }
  }

  if (!firstIncomplete) {
    return { url: `/learn/${topicId}`, label: 'Review', type: 'review' }
  }

  if (allContentViewed) {
    return {
      url: `/dashboard/topics/${topicId}?module=${firstIncomplete.id}&step=quiz`,
      label: 'Take Quiz',
      type: 'quiz',
    }
  }

  const state = ensureModule(progress || {}, firstIncomplete.id)
  let step = 'explainer'
  if (state.explainer && !state.resources) step = 'resources'
  else if (state.explainer && state.resources && !state.quiz) step = 'quiz'

  return {
    url: `/dashboard/topics/${topicId}?module=${firstIncomplete.id}&step=${step}`,
    label: 'Continue Learning',
    type: 'continue',
  }
}

// ==================== Topic Assistant ====================

export async function askTopicAssistant(topicTitle, question, history = []) {
  return apiFetch('/assistant/chat', {
    method: 'POST',
    body: {
      topicTitle,
      question,
      history: history.slice(-10),
    },
  })
}

// ==================== Roadmap Progress (Supabase-backed) ====================

export async function getRoadmapProgressFromServer(topicId) {
  try {
    return await apiFetch(`/progress/${encodeURIComponent(topicId)}`)
  } catch {
    return {}
  }
}

export function updateRoadmapProgressOnServer(topicId, subtopicId, updates) {
  // Enqueue rather than fire-and-forget so the write survives offline/blips.
  // Deduped per (topic, subtopic): the latest state replaces an un-sent earlier one.
  enqueueSync(
    {
      kind: 'progress',
      topicId,
      subtopicId,
      explainerDone: updates.explainer ?? undefined,
      resourcesDone: updates.resources ?? undefined,
      quizDone: updates.quiz ?? undefined,
    },
    `progress:${topicId}:${subtopicId}`,
  )
}

// ==================== Spaced Repetition & Daily Progress ====================

export async function getReviewQueue() {
  return apiFetch('/review-queue')
}

export async function getDailyProgress() {
  return apiFetch('/daily-progress')
}

export async function updateDailyGoal({ dailyQuizGoal, dailyMinutesGoal } = {}) {
  return apiFetch('/daily-progress/goal', {
    method: 'PUT',
    body: { dailyQuizGoal, dailyMinutesGoal },
  })
}

// ==================== Resource Voting ====================

export async function voteResource({ topicId, subtopicId, resourceUrl, vote }) {
  return apiFetch('/resources/vote', {
    method: 'POST',
    body: { topicId, subtopicId, resourceUrl, vote },
  })
}

export async function getResourceVotes(topicId) {
  return apiFetch(`/resources/votes?topic_id=${encodeURIComponent(topicId)}`)
}

// ==================== Generated Content Storage ====================

export async function storeGeneratedContent({ topicId, subtopicId, contentType, content }) {
  return apiFetch('/content/store', {
    method: 'POST',
    body: { topicId, subtopicId, contentType, content },
  })
}

export async function getGeneratedContent(topicId, { contentType, subtopicId } = {}) {
  const qs = new URLSearchParams()
  if (contentType) qs.set('content_type', contentType)
  if (subtopicId) qs.set('subtopic_id', subtopicId)
  return apiFetch(`/content/${encodeURIComponent(topicId)}?${qs}`)
}

// ==================== Classrooms / Collaborative ====================

export async function createClassroom({ name, description }) {
  return apiFetch('/classrooms', {
    method: 'POST',
    body: { name, description },
  })
}

export async function joinClassroom(joinCode) {
  return apiFetch('/classrooms/join', {
    method: 'POST',
    body: { joinCode },
  })
}

export async function listClassrooms() {
  return apiFetch('/classrooms')
}

export async function getClassroom(classroomId) {
  return apiFetch(`/classrooms/${encodeURIComponent(classroomId)}`)
}

export async function shareRoadmap({ topicId, title, subtopics, description, classroomId, isPublic }) {
  return apiFetch('/shared-roadmaps', {
    method: 'POST',
    body: { topicId, title, subtopics, description, classroomId, isPublic },
  })
}

export async function listSharedRoadmaps(classroomId) {
  const qs = classroomId ? `?classroom_id=${encodeURIComponent(classroomId)}` : ''
  return apiFetch(`/shared-roadmaps${qs}`)
}

export async function getLeaderboard(classroomId) {
  const qs = classroomId ? `?classroom_id=${encodeURIComponent(classroomId)}` : ''
  return apiFetch(`/leaderboard${qs}`)
}

// ==================== Study Sessions ====================

export async function startStudySession({ topicId, subtopicId, activity }) {
  return apiFetch('/study-sessions/start', {
    method: 'POST',
    body: { topicId, subtopicId, activity },
  })
}

export async function endStudySession({ sessionId, durationSeconds }) {
  return apiFetch('/study-sessions/end', {
    method: 'POST',
    body: { sessionId, durationSeconds },
  })
}

export async function getStudyStats(days = 30) {
  return apiFetch(`/study-sessions/stats?days=${days}`)
}

// ==================== Learning Report ====================

export async function getLearningReport() {
  return apiFetch('/report')
}

// ==================== Usage Stats ====================

export async function getUsageStats() {
  return apiFetch('/usage-stats')
}

// Inject the actual network sender into the sync queue (kept here to avoid an
// import cycle between syncQueue.js and api.js).
configureSyncSender(async (payload) => {
  if (payload.kind === 'progress') {
    await apiFetch('/progress', {
      method: 'PUT',
      body: {
        topicId: payload.topicId,
        subtopicId: payload.subtopicId,
        explainerDone: payload.explainerDone,
        resourcesDone: payload.resourcesDone,
        quizDone: payload.quizDone,
      },
    })
  } else if (payload.kind === 'settings') {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) return // not signed in — drop silently
    await apiFetch('/settings', { method: 'PUT', body: { lastViewed: payload.lastViewed } })
  }
})
