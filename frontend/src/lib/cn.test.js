import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
  })

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'visible')
    expect(result).toContain('base')
    expect(result).toContain('visible')
    expect(result).not.toContain('hidden')
  })

  it('handles undefined', () => {
    const result = cn('foo', undefined, null, 'bar')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
  })

  it('handles tailwind merge conflicts', () => {
    const result = cn('px-2', 'px-4')
    expect(result).toContain('px-4')
    expect(result).not.toContain('px-2')
  })
})
