import { getRoadmapProgressFromServer, updateRoadmapProgressOnServer } from '../../services/api'

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

  // Best-effort sync each changed module to Supabase
  for (const [subtopicId, state] of Object.entries(next)) {
    if (typeof state === 'object' && state !== null) {
      updateRoadmapProgressOnServer(topicId, subtopicId, state)
    }
  }
}

export async function loadAndMergeProgress(topicId) {
  const local = getRoadmapProgress(topicId)
  try {
    const remote = await getRoadmapProgressFromServer(topicId)
    if (!remote || Object.keys(remote).length === 0) return local

    // Merge: true wins over false (progress can only advance — conflict-free OR-merge).
    const merged = { ...local }
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
    for (const key of keys) {
      const localState = local[key] || { explainer: false, resources: false, quiz: false }
      const remoteState = remote[key] || { explainer: false, resources: false, quiz: false }
      const mergedState = {
        explainer: localState.explainer || remoteState.explainer,
        resources: localState.resources || remoteState.resources,
        quiz: localState.quiz || remoteState.quiz,
      }
      merged[key] = mergedState

      // Reconcile: if the merged state is ahead of what the server has, re-push it.
      // Covers writes that were lost while offline on a previous session.
      const aheadOfRemote =
        mergedState.explainer !== remoteState.explainer ||
        mergedState.resources !== remoteState.resources ||
        mergedState.quiz !== remoteState.quiz
      if (aheadOfRemote) {
        updateRoadmapProgressOnServer(topicId, key, mergedState)
      }
    }
    window.localStorage.setItem(keyFor(topicId), JSON.stringify(merged))
    return merged
  } catch {
    return local
  }
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
  const keys = ['explainer', 'resources', 'quiz']
  const done = keys.filter((k) => !!moduleState?.[k]).length
  return done / keys.length
}
