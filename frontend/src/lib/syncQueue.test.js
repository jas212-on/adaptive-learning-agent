import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => { store[key] = String(val) },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Mock navigator.onLine
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  writable: true,
})

describe('syncQueue', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('should have localStorage available', () => {
    localStorage.setItem('test', 'value')
    expect(localStorage.getItem('test')).toBe('value')
  })

  it('should store items in localStorage', () => {
    localStorage.setItem('syncQueue', JSON.stringify([{ kind: 'test' }]))
    const data = JSON.parse(localStorage.getItem('syncQueue'))
    expect(data).toHaveLength(1)
    expect(data[0].kind).toBe('test')
  })
})
