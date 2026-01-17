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
      questions: false,
      quiz: false,
    }
  )
}

export function moduleCompletion(moduleState) {
  const keys = ['explainer', 'resources', 'questions', 'quiz']
  const done = keys.filter((k) => !!moduleState?.[k]).length
  return done / keys.length
}
