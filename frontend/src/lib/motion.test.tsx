import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePrefersReducedMotion, useCountUp, wordChild, wordStagger, hoverLift, arrowNudge } from './motion'

/**
 * These tests exist because reduced motion is an accessibility contract, not a
 * preference. `<MotionConfig reducedMotion="user">` covers transforms on Motion
 * components; it does NOT stop a scroll-linked value or a CSS loop, which is exactly
 * what the additions in this file introduce. The guard is the mitigation, so the guard
 * is what gets pinned.
 */

type Listener = (e: MediaQueryListEvent) => void

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>()
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, l: Listener) => { listeners.add(l) },
    removeEventListener: (_: string, l: Listener) => { listeners.delete(l) },
  }
  vi.stubGlobal('matchMedia', vi.fn(() => mql))
  return {
    /** Simulate the user changing the OS setting while the tab is open. */
    change(next: boolean) {
      mql.matches = next
      listeners.forEach((l) => l({ matches: next } as MediaQueryListEvent))
    },
    listenerCount: () => listeners.size,
  }
}

describe('usePrefersReducedMotion', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('reports false when the user has expressed no preference', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
  })

  it('reports true when reduce is set', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(true)
  })

  it('keeps listening, so toggling the OS setting mid-session stops the motion', () => {
    const mq = mockMatchMedia(false)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
    act(() => { mq.change(true) })
    expect(result.current).toBe(true)
  })

  it('removes its listener on unmount rather than leaking one per mount', () => {
    const mq = mockMatchMedia(false)
    const { unmount } = renderHook(() => usePrefersReducedMotion())
    expect(mq.listenerCount()).toBe(1)
    unmount()
    expect(mq.listenerCount()).toBe(0)
  })

  it('assumes reduced motion when matchMedia is unavailable, so the safe branch is the default', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(true)
  })
})

describe('useCountUp', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('shows the final value immediately under reduced motion', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useCountUp(99))
    act(() => { result.current.begin() })
    expect(result.current.display).toBe(99)
  })

  it('shows the real value before it is ever begun, so a static render is never a zero', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useCountUp(42))
    expect(result.current.display).toBe(42)
  })

  it('returns null for an absent value rather than counting to zero', () => {
    // Principle 7: a stat the database cannot support renders nothing. Counting an
    // unknown value up to 0 would state a fact we do not have.
    mockMatchMedia(false)
    const { result } = renderHook(() => useCountUp(null))
    expect(result.current.display).toBeNull()
    const undef = renderHook(() => useCountUp(undefined))
    expect(undef.result.current.display).toBeNull()
  })

  it('lands exactly on the target value, never one short', () => {
    mockMatchMedia(false)
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const { result } = renderHook(() => useCountUp(100, 900))
    act(() => { result.current.begin() })
    // Drive past the full duration.
    act(() => { now = 900; frames.forEach((f) => f(900)) })
    expect(result.current.display).toBe(100)
  })
})

describe('motion variant shapes', () => {
  it('word stagger is ~45ms, matching the 40-60ms reference band', () => {
    const visible = wordStagger.visible as { transition: { staggerChildren: number } }
    expect(visible.transition.staggerChildren).toBeCloseTo(0.045)
  })

  it('word travel is em-relative, so a 93px headline does not fly apart', () => {
    const hidden = wordChild.hidden as { y: string }
    expect(hidden.y).toMatch(/em$/)
  })

  it('hover lifts 2px and never scales', () => {
    expect(hoverLift.hover.y).toBe(-2)
    expect(hoverLift.hover).not.toHaveProperty('scale')
  })

  it('arrow nudges 3px', () => {
    expect(arrowNudge.hover.x).toBe(3)
  })
})
