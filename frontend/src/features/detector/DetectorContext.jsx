import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import * as api from '../../services/api'

const DetectorContext = createContext(null)

export function DetectorProvider({ children }) {
  const [running, setRunning] = useState(false)
  const [startedAt, setStartedAt] = useState(null)
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const lastStartRef = useRef(0)

  const start = useCallback(async () => {
    setError(null)
    setLoading(true)
    const startToken = Date.now()
    lastStartRef.current = startToken

    try {
      const res = await api.startDetection()
      // prevent out-of-order resolves
      if (lastStartRef.current !== startToken) return
      setRunning(true)
      setStartedAt(Date.now())
      setTopics(res.topics)
    } catch (err) {
      setError(err?.message || 'Failed to start detection')
    } finally {
      if (lastStartRef.current === startToken) setLoading(false)
    }
  }, [])

  const stop = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      await api.stopDetection()
      setRunning(false)
      setStartedAt(null)
    } catch (err) {
      setError(err?.message || 'Failed to stop detection')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshTopics = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await api.listDetectedTopics()
      setTopics(res)
    } catch (err) {
      setError(err?.message || 'Failed to load topics')
    } finally {
      setLoading(false)
    }
  }, [])

  const value = useMemo(
    () => ({ running, startedAt, topics, loading, error, start, stop, refreshTopics }),
    [running, startedAt, topics, loading, error, start, stop, refreshTopics],
  )

  return <DetectorContext.Provider value={value}>{children}</DetectorContext.Provider>
}

export function useDetector() {
  const ctx = useContext(DetectorContext)
  if (!ctx) throw new Error('useDetector must be used within DetectorProvider')
  return ctx
}
