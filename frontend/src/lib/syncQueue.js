/**
 * Write-behind sync queue for best-effort mutations (roadmap progress, settings).
 *
 * Design goals:
 *  - Never lose a user action because the network blipped or they were offline.
 *  - Keep the hybrid model intact: only small user-state mutations are queued;
 *    large data (OCR text, generated caches) stays local and is never queued.
 *
 * Mechanics:
 *  - Pending mutations are persisted in localStorage under `ala.syncQueue` so they
 *    survive reloads.
 *  - Each entry is keyed by a caller-provided `dedupeKey` so the latest state for a
 *    given (topic, subtopic) replaces an earlier un-sent one (writes only advance).
 *  - The queue flushes on a debounce, retries with backoff, and re-flushes whenever
 *    the tab regains connectivity (`online`) or focus.
 */

const STORAGE_KEY = 'ala.syncQueue'
const FLUSH_DEBOUNCE_MS = 600
const MAX_ATTEMPTS = 6

let sender = null // (entry) => Promise<void>, injected by api.js to avoid a cycle
let flushTimer = null
let flushing = false

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function write(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // storage full / unavailable — nothing we can safely do
  }
}

/** Register the function that actually performs the network write. */
export function configureSyncSender(fn) {
  sender = fn
}

/**
 * Enqueue a mutation. `payload` is opaque to the queue and handed to the sender.
 * `dedupeKey` collapses repeated writes for the same logical target.
 */
export function enqueueSync(payload, dedupeKey) {
  const entries = read()
  const key = dedupeKey || `${Date.now()}-${Math.random()}`
  const existingIdx = entries.findIndex((e) => e.key === key)
  const entry = { key, payload, attempts: 0, ts: Date.now() }
  if (existingIdx >= 0) entries[existingIdx] = entry
  else entries.push(entry)
  write(entries)
  scheduleFlush()
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flushQueue, FLUSH_DEBOUNCE_MS)
}

export async function flushQueue() {
  if (flushing || !sender) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  flushing = true
  try {
    let entries = read()
    const remaining = []

    for (const entry of entries) {
      try {
        await sender(entry.payload)
        // success → drop entry
      } catch {
        entry.attempts = (entry.attempts || 0) + 1
        if (entry.attempts < MAX_ATTEMPTS) {
          remaining.push(entry)
        }
        // else: give up on this entry to avoid an unbounded queue
      }
    }

    write(remaining)

    if (remaining.length) {
      // Back off before the next attempt.
      setTimeout(scheduleFlush, 2000)
    }
  } finally {
    flushing = false
  }
}

// Re-flush opportunistically when connectivity / focus returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => scheduleFlush())
  window.addEventListener('focus', () => scheduleFlush())
  // Kick a flush shortly after load for anything left from a previous session.
  setTimeout(() => scheduleFlush(), 1500)
}
