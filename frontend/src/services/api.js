// Mock API layer. Replace these with real endpoints later.

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
  await sleep(1200)
  // In real backend: POST /detector/start
  return {
    runId: uid('run'),
    topics: MOCK_TOPICS,
  }
}

export async function stopDetection() {
  await sleep(350)
  // In real backend: POST /detector/stop
  return { ok: true }
}

export async function listDetectedTopics() {
  await sleep(400)
  // In real backend: GET /detector/topics
  return MOCK_TOPICS
}

export async function getTopic(topicId) {
  await sleep(500)
  const topic = MOCK_TOPICS.find((t) => t.id === topicId)
  if (!topic) throw new Error('Topic not found')

  return {
    ...topic,
    detectedConcepts: [
      { label: 'Dependency arrays', score: 0.82 },
      { label: 'Side effects', score: 0.76 },
      { label: 'Stale closures', score: 0.62 },
    ],
  }
}

export async function explainTopic(topicId) {
  await sleep(700)
  return {
    topicId,
    overview:
      'A structured explainer that goes beyond what was detected on-screen. It covers prerequisites, mental models, and common pitfalls.',
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

export async function suggestResources(topicId) {
  await sleep(650)
  return {
    topicId,
    resources: [
      { type: 'docs', title: 'Official docs', url: 'https://example.com/docs' },
      { type: 'video', title: 'Crash course', url: 'https://example.com/video' },
      { type: 'practice', title: 'Practice set', url: 'https://example.com/practice' },
    ],
  }
}

export async function generateQuestions(topicId) {
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

export async function getAnalytics() {
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

export async function getSuggestions() {
  await sleep(500)
  return {
    suggestions: [
      { id: uid('s'), title: 'Learn state management basics', reason: 'Often paired with React Hooks' },
      { id: uid('s'), title: 'Practice SQL aggregate queries', reason: 'Natural follow-up to joins' },
      { id: uid('s'), title: 'Review time complexity', reason: 'Helps analyze scheduling trade-offs' },
    ],
  }
}

export async function generateTimetable({ syllabusLines, days }) {
  await sleep(700)
  const topics = syllabusLines.filter(Boolean)
  const nDays = Math.max(1, Number(days) || 1)
  const plan = Array.from({ length: nDays }, (_, i) => ({ day: i + 1, items: [] }))
  topics.forEach((t, idx) => {
    plan[idx % nDays].items.push({ topic: t, task: 'Study + 10 practice questions' })
  })
  return { days: nDays, plan }
}

export async function getConceptGraph(topicId) {
  await sleep(650)
  return {
    topicId,
    nodes: [
      { id: 'prereq-1', label: 'Prerequisite A', kind: 'prereq' },
      { id: 'prereq-2', label: 'Prerequisite B', kind: 'prereq' },
      { id: 'core', label: 'Core Concept', kind: 'core' },
      { id: 'next-1', label: 'Next Topic 1', kind: 'next' },
      { id: 'next-2', label: 'Next Topic 2', kind: 'next' },
    ],
    edges: [
      { from: 'prereq-1', to: 'core' },
      { from: 'prereq-2', to: 'core' },
      { from: 'core', to: 'next-1' },
      { from: 'core', to: 'next-2' },
    ],
  }
}
