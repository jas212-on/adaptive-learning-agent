const keyFor = (topicId) => `ala.roadmapProgress.${topicId}`

export function getRoadmapProgress(topicId) {
  try {
    const raw = window.localStorage.getItem(keyFor(topicId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function setRoadmapProgress(topicId, next) {
  window.localStorage.setItem(keyFor(topicId), JSON.stringify(next))
}

export function ensureModule(progress, moduleId) {
  return (
    progress[moduleId] || {
      explainer: false,
      resources: false,
      quiz: false,
    }
  )
}

export function moduleCompletion(moduleState) {
  // Progress is intentionally based on 3 core actions:
  // explainer (+33%), resources (+33%), quiz pass (+34%).
  // "questions" is treated as optional and does not affect completion.
  const keys = ['explainer', 'resources', 'quiz']
  const done = keys.filter((k) => !!moduleState?.[k]).length
  return done / keys.length
}
