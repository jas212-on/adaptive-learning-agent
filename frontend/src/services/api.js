// Mock API layer. Replace these with real endpoints later.

const API_BASE = import.meta?.env?.VITE_API_BASE_URL || '/api'

async function apiFetch(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const data = await res.json()
      detail = data?.detail ? String(data.detail) : ''
    } catch {
      // ignore
    }
    throw new Error(detail || `API request failed: ${res.status} ${res.statusText}`)
  }

  // FastAPI returns JSON for our endpoints
  return res.json()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

const MOCK_TOPICS = [
  {
    id: 'react-hooks',
    title: 'React Hooks: useEffect & dependencies',
    level: 'intermediate',
    confidence: 0.86,
    tags: ['react', 'hooks', 'frontend'],
    detectedAt: new Date().toISOString(),
    snippets: [
      {
        source: 'screen',
        where: 'VS Code editor',
        text: 'useEffect(() => { ... }, [userId]) // dependency array',
        strength: 'high',
      },
      {
        source: 'screen',
        where: 'Browser tab',
        text: 'Avoid stale closures; memoize callbacks',
        strength: 'medium',
      },
    ],
  },
  {
    id: 'sql-joins',
    title: 'SQL Joins and Cardinality',
    level: 'beginner',
    confidence: 0.74,
    tags: ['sql', 'database'],
    detectedAt: new Date().toISOString(),
    snippets: [
      {
        source: 'screen',
        where: 'PDF slide',
        text: 'INNER JOIN vs LEFT JOIN; result set differences',
        strength: 'high',
      },
    ],
  },
  {
    id: 'os-scheduling',
    title: 'CPU Scheduling: Round Robin',
    level: 'advanced',
    confidence: 0.63,
    tags: ['os', 'systems'],
    detectedAt: new Date().toISOString(),
    snippets: [
      {
        source: 'screen',
        where: 'Lecture notes',
        text: 'Time quantum trade-offs; context switch overhead',
        strength: 'medium',
      },
    ],
  },
]

export async function login({ email }) {
  await sleep(700)
  return {
    token: uid('token'),
    user: {
      id: uid('user'),
      name: email?.split('@')?.[0] || 'Learner',
      email,
    },
  }
}

export async function signup({ name, email }) {
  await sleep(800)
  return {
    token: uid('token'),
    user: {
      id: uid('user'),
      name: name || 'Learner',
      email,
    },
  }
}

export async function startDetection() {
  // Real backend: POST /detector/start (proxied as /api/detector/start)
  try {
    await apiFetch('/detector/start', { method: 'POST' })
    const topics = await apiFetch('/detector/topics')
    return { topics }
  } catch (e) {
    // Fallback to mock if backend isn't running yet
    await sleep(600)
    return { topics: MOCK_TOPICS }
  }
}

export async function stopDetection() {
  try {
    await apiFetch('/detector/stop', { method: 'POST' })
    return { ok: true }
  } catch (e) {
    await sleep(250)
    return { ok: true }
  }
}

export async function getDetectorStatus() {
  try {
    return await apiFetch('/detector/status')
  } catch (e) {
    return { running: false, exit_code: null }
  }
}

export async function listDetectedTopics() {
  try {
    return await apiFetch('/detector/topics')
  } catch (e) {
    await sleep(250)
    return MOCK_TOPICS
  }
}

export async function getTopic(topicId) {
  try {
    const t = await apiFetch(`/detector/topics/${encodeURIComponent(topicId)}`)
    return {
      ...t,
      // Keep UI stable even if backend doesn't provide these yet
      detectedConcepts: t.detectedConcepts || [],
      tags: t.tags || [],
      subtopics: t.subtopics || [],
      level: t.level || 'intermediate',
    }
  } catch (e) {
    await sleep(300)
    const topic = MOCK_TOPICS.find((t) => t.id === topicId)
    if (!topic) throw new Error('Topic not found')
    return {
      ...topic,
      detectedConcepts: [],
      subtopics: [],
    }
  }
}

export async function explainTopic(topicId, opts = {}) {
  const subtopicId = opts?.subtopicId ? String(opts.subtopicId) : null
  const force = !!opts?.force

  const qs = new URLSearchParams()
  if (subtopicId) qs.set('subtopic_id', subtopicId)
  if (force) qs.set('force', 'true')

  try {
    if (!subtopicId) throw new Error('subtopicId is required')
    return await apiFetch(`/detector/topics/${encodeURIComponent(topicId)}/explainer?${qs.toString()}`)
  } catch (e) {
    await sleep(700)
    return {
      topicId,
      subtopicId: subtopicId || 'subtopic',
      overview:
        'A structured explainer that goes beyond what was detected on-screen. It covers prerequisites, mental models, and common pitfalls.',
      prerequisites: ['Core concepts', 'Common terminology', 'Typical use-cases'],
      keyIdeas: ['What it is', 'Why it matters', 'How to practice effectively'],
      pitfalls: ['Misconceptions', 'Edge cases', 'How to debug mistakes'],
      sections: [
        {
          title: 'Prerequisites',
          bullets: ['Core concepts', 'Common terminology', 'Typical use-cases'],
        },
        {
          title: 'Key Ideas',
          bullets: ['What it is', 'Why it matters', 'How to practice effectively'],
        },
        {
          title: 'Pitfalls',
          bullets: ['Misconceptions', 'Edge cases', 'How to debug mistakes'],
        },
      ],
    }
  }
}

export async function generateRoadmap(topicId, level = 'intermediate') {
  await sleep(900)
  return {
    topicId,
    level,
    steps: [
      { title: 'Foundation', items: ['Core definitions', 'Simple examples', 'Glossary'] },
      { title: 'Practice', items: ['Guided exercises', 'Mini-project', 'Flashcards'] },
      { title: 'Mastery', items: ['Advanced patterns', 'Real-world scenarios', 'Mock interview questions'] },
    ],
  }
}

export async function suggestResources(topicId, opts = {}) {
  const subtopicId = opts?.subtopicId ? String(opts.subtopicId) : null
  const limit = Number.isFinite(opts?.limit) ? opts.limit : 40

  const qs = new URLSearchParams()
  if (subtopicId) qs.set('subtopic_id', subtopicId)
  if (limit) qs.set('limit', String(limit))

  try {
    return await apiFetch(`/detector/topics/${encodeURIComponent(topicId)}/resources?${qs.toString()}`)
  } catch (e) {
    // Bubble error so the UI doesn't show irrelevant fallback resources.
    throw e
  }
}

/**
 * Generate a quiz for a specific subtopic.
 * @param {string} topicId - The topic ID
 * @param {Object} opts - Options
 * @param {string} opts.subtopicId - The subtopic ID (required)
 * @param {number} opts.nQuestions - Number of questions (default 5)
 * @param {boolean} opts.force - Force regeneration (default false)
 * @returns {Promise<Object>} Quiz data with questions
 */
export async function generateQuiz(topicId, opts = {}) {
  const subtopicId = opts?.subtopicId ? String(opts.subtopicId) : null
  const nQuestions = Number.isFinite(opts?.nQuestions) ? opts.nQuestions : 5
  const force = Boolean(opts?.force)

  if (!subtopicId) {
    throw new Error('subtopicId is required for quiz generation')
  }

  const qs = new URLSearchParams()
  qs.set('subtopic_id', subtopicId)
  qs.set('n_questions', String(nQuestions))
  if (force) qs.set('force', 'true')

  return apiFetch(`/detector/topics/${encodeURIComponent(topicId)}/quiz?${qs.toString()}`)
}

export async function generateQuestions(topicId, opts = {}) {
  const subtopicId = opts?.subtopicId ? String(opts.subtopicId) : null
  const nQuestions = Number.isFinite(opts?.nQuestions) ? opts.nQuestions : 5
  const force = Boolean(opts?.force)

  // If we don't have a subtopic, keep the old mock behavior (used by other pages).
  if (!subtopicId) {
    await sleep(850)
    return {
      topicId,
      questions: [
        {
          id: uid('q'),
          type: 'mcq',
          prompt: 'Which option best describes the concept?',
          choices: ['A', 'B', 'C', 'D'],
          answerIndex: 1,
          skill: 'conceptual',
        },
        {
          id: uid('q'),
          type: 'mcq',
          prompt: 'Pick the correct next step in a workflow.',
          choices: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
          answerIndex: 2,
          skill: 'procedural',
        },
      ],
    }
  }

  const qs = new URLSearchParams()
  if (subtopicId) qs.set('subtopic_id', subtopicId)
  qs.set('n_questions', String(nQuestions))
  if (force) qs.set('force', 'true')

  try {
    return await apiFetch(`/detector/topics/${encodeURIComponent(topicId)}/quiz?${qs.toString()}`)
  } catch (e) {
    // If backend isn't running yet, keep the UI usable with a small mock.
    await sleep(350)
    return {
      topicId,
      subtopicId,
      questions: [
        {
          question: 'Which option best describes the concept?',
          options: ['A', 'B', 'C', 'D'],
        },
        {
          question: 'Pick the correct next step in a workflow.',
          options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        },
      ],
    }
  }
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

export async function getAnalytics() {
  try {
    return await apiFetch('/analytics')
  } catch (e) {
    // If backend isn't running yet, keep the UI usable with a small mock.
    await sleep(600)
    return {
      streakDays: 7,
      timeSpentMinutes: 320,
      topicsLearned: 5,
      avgScore: 76,
      byTopic: [
        { id: 'react-hooks', title: 'React Hooks', progress: 0.55, score: 72, minutes: 90 },
        { id: 'sql-joins', title: 'SQL Joins', progress: 0.35, score: 64, minutes: 55 },
        { id: 'os-scheduling', title: 'CPU Scheduling', progress: 0.2, score: 58, minutes: 35 },
      ],
    }
  }
}

export async function getSuggestions(force = false) {
  const params = new URLSearchParams()
  if (force) params.set('force', 'true')
  
  try {
    return await apiFetch(`/suggestions?${params.toString()}`)
  } catch (e) {
    // Fallback if backend isn't running
    await sleep(500)
    return {
      suggestions: [
        { id: 'fallback-1', title: 'Learn state management basics', reason: 'Often paired with React Hooks', priority: 'high', category: 'parallel', relatedTo: [] },
        { id: 'fallback-2', title: 'Practice SQL aggregate queries', reason: 'Natural follow-up to joins', priority: 'medium', category: 'advanced', relatedTo: [] },
        { id: 'fallback-3', title: 'Review time complexity', reason: 'Helps analyze scheduling trade-offs', priority: 'medium', category: 'prerequisite', relatedTo: [] },
      ],
      error: 'Using fallback suggestions - backend not available',
    }
  }
}

/**
 * Generate a study timetable using the constraint-based scheduler.
 * 
 * @param {Object} params - Timetable generation parameters
 * @param {Array} params.events - Fixed events (exams, assignments, deadlines)
 * @param {Object} params.availability - Daily availability settings
 * @param {Object} params.preferences - Study preferences
 * @param {Array} params.topics - Learning topics
 * @param {string} [params.currentDate] - Start date (ISO format)
 * @returns {Promise<Object>} Generated timetable
 */
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

/**
 * Get a sample timetable for demonstration.
 * @returns {Promise<Object>} Sample timetable
 */
export async function getSampleTimetable() {
  return apiFetch('/timetable/sample')
}

/**
 * Validate timetable inputs without generating.
 * @param {Object} params - Same as generateTimetable
 * @returns {Promise<Object>} Validation result
 */
export async function validateTimetableInputs(params) {
  return apiFetch('/timetable/validate', {
    method: 'POST',
    body: params,
  })
}

/**
 * Fetch concept dependency graph for a topic.
 * 
 * @param {string} topicId - The topic ID to build graph for
 * @param {Object} options - Optional parameters
 * @param {number} options.maxDepth - Max depth of subtopic expansion (0-2, default 2)
 * @param {number} options.maxChildren - Max children per node (1-10, default 5)
 * @param {boolean} options.useGemini - Use Gemini for expansion (default true)
 * @returns {Promise<{nodes: Array, edges: Array, rootId: string, maxDepth: number}>}
 */
export async function getConceptGraph(topicId, options = {}) {
  const {
    maxDepth = 2,
    maxChildren = 5,
    useGemini = true,
  } = options

  const params = new URLSearchParams({
    max_depth: maxDepth.toString(),
    max_children: maxChildren.toString(),
    use_gemini: useGemini.toString(),
  })

  return apiFetch(`/detector/topics/${encodeURIComponent(topicId)}/graph?${params}`)
}

// ==================== Resume Learning Functionality ====================

const LAST_VIEWED_KEY = 'ala.lastViewed'

/**
 * Save the last viewed position for a topic
 * @param {string} topicId 
 * @param {Object} position - { module, step }
 */
export function saveLastViewedPosition(topicId, position) {
  try {
    const data = JSON.parse(localStorage.getItem(LAST_VIEWED_KEY) || '{}')
    data[topicId] = {
      ...position,
      timestamp: Date.now(),
    }
    localStorage.setItem(LAST_VIEWED_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

/**
 * Get the last viewed position for a topic
 * @param {string} topicId 
 * @returns {Object|null} - { module, step, timestamp } or null
 */
export function getLastViewedPosition(topicId) {
  try {
    const data = JSON.parse(localStorage.getItem(LAST_VIEWED_KEY) || '{}')
    return data[topicId] || null
  } catch {
    return null
  }
}

/**
 * Get the resume learning URL for a topic based on progress
 * @param {string} topicId 
 * @param {Object} topic - Topic data with subtopics
 * @param {Object} progress - Roadmap progress from localStorage
 * @returns {Object} - { url, label, type }
 */
export function getResumeLearningInfo(topicId, topic, progress) {
  if (!topic?.subtopics?.length) {
    return {
      url: `/dashboard/topics/${topicId}`,
      label: 'View Topic',
      type: 'view',
    }
  }

  // Helper to slugify subtopic names
  const slugify = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const subtopics = topic.subtopics.map((t, idx) => ({
    id: slugify(t) || `subtopic-${idx + 1}`,
    title: t,
  }))

  // Check last viewed position first
  const lastViewed = getLastViewedPosition(topicId)
  if (lastViewed?.module) {
    return {
      url: `/dashboard/topics/${topicId}?module=${lastViewed.module}&step=${lastViewed.step || 'explainer'}`,
      label: 'Continue Learning',
      type: 'continue',
    }
  }

  // Find first incomplete module
  const moduleCompletion = (state) => {
    const keys = ['explainer', 'resources', 'quiz']
    const done = keys.filter((k) => !!state?.[k]).length
    return done / keys.length
  }

  const ensureModule = (prog, id) =>
    prog[id] || { explainer: false, resources: false, quiz: false }

  // Check if all content viewed but quiz not passed
  let allContentViewed = true
  let firstIncomplete = null

  for (const m of subtopics) {
    const state = ensureModule(progress || {}, m.id)
    const completion = moduleCompletion(state)

    if (completion < 1 && !firstIncomplete) {
      firstIncomplete = m

      // Determine which step to start
      let step = 'explainer'
      if (state.explainer && !state.resources) step = 'resources'
      else if (state.explainer && state.resources && !state.quiz) step = 'quiz'

      if (!state.explainer || !state.resources) {
        allContentViewed = false
      }
    }
  }

  if (!firstIncomplete) {
    // All complete
    return {
      url: `/learn/${topicId}`,
      label: 'Review',
      type: 'review',
    }
  }

  if (allContentViewed) {
    return {
      url: `/dashboard/topics/${topicId}?module=${firstIncomplete.id}&step=quiz`,
      label: 'Take Quiz',
      type: 'quiz',
    }
  }

  // Determine step based on progress
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

