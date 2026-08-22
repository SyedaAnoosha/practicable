import { useEffect, useRef, useState } from 'react'
import { useScroll, useTransform } from 'motion/react'
import type { Variants, Transition } from 'motion/react'

/** Shared motion vocabulary, kept in one file so nothing invents its own duration and
 * the whole product moves with the same weight.
 *
 * Nothing here needs a `prefers-reduced-motion` branch — `<MotionConfig
 * reducedMotion="user">` in main.tsx neutralises transforms tree-wide, and theme.css
 * collapses CSS animation durations.
 */

/** Expo-out. The house curve — slow settle, no overshoot. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

/** Parent for anything that reveals a list of children in sequence. */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

/** The child of `staggerContainer`. Rises 24px as it fades in. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EASE_OUT_EXPO },
  },
}

/** A shorter rise for dense content (form fields, footer columns) where 24px of travel
 *  on every row reads as restless rather than considered. */
export const riseItemSm: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
}

/** A form field entrance: a spring rather than a duration, with a shorter 15px rise.
 *  Springs settle at slightly different times per item, which stops a stack of
 *  identical form rows from looking like one block sliding up. Pair with
 *  `authStagger` rather than the wider stagger used for page-level content. */
export const springItem: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
}

/** Tighter parent for form stacks. */
export const authStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

/** Standard `whileInView` config. `once: true` so a section never re-animates every
 *  time it scrolls back into view. `amount: 0.15` fires early enough that the
 *  animation is finishing as the section arrives. */
export const inViewOnce = { once: true, amount: 0.15 } as const

/** The header's own entrance — top-level chrome drops in rather than rising, so it
 *  reads as arriving from off-canvas instead of competing with the content below. */
export const headerEnter: Transition = { duration: 0.6, ease: 'easeOut' }

/* ────────────────────────────────────────────────────────────────────────────
 * `[ADDED 2026-08-22, REDESIGN_SUMMARY.md §5.2 / D1.3]`
 *
 * Everything above is an ENTRANCE. Once a section had revealed, the page was
 * completely static — the Framer reference set is never fully static; something in
 * the background is always slowly moving (FRAMER_MOTION_REFERENCE.md §1.3).
 *
 * ⚠ The reduced-motion contract changes for what follows. `<MotionConfig
 * reducedMotion="user">` neutralises TRANSFORMS on Motion components, which is
 * sufficient for an entrance (it simply arrives already in place). It does NOT stop:
 *   - a CSS `@keyframes` loop, and
 *   - a scroll-linked `useTransform`, which recomputes from scroll rather than from
 *     an animation Motion controls.
 * A continuously-moving background is a vestibular trigger, so each of those needs its
 * own explicit guard. `usePrefersReducedMotion` below is that guard, and the ambient
 * loop additionally guards itself in CSS.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Reads the media query and keeps listening — a user can change the OS setting while
 *  the tab is open, and a parallax that only checked at mount would keep running.
 *  Returns `true` during SSR/tests so the safe branch is the default. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    setReduced(mq.matches)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/** Headline words rise and fade ~45ms apart (all nine Framer references open this way;
 *  ours faded whole blocks). Pair with `wordChild` on each word.
 *
 *  Under reduced motion Motion renders the settled state, so the headline is simply
 *  there — which is the correct behaviour, not a degradation. */
export const wordStagger: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
}

/** The child of `wordStagger`. Shorter travel than `riseItem` — a word rising 24px
 *  inside a 93px headline reads as the letters coming apart. */
export const wordChild: Variants = {
  hidden: { opacity: 0, y: '0.35em' },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT_EXPO } },
}

/** Scroll-linked parallax for a BACKGROUND layer. Returns a ref to attach to the
 *  scroll container and a `y` motion value for the layer inside it.
 *
 *  `speed` is the fraction of the element's own travel, capped at 12% (D1.3) — beyond
 *  that the background visibly detaches from the content and reads as a broken sticky.
 *  Returns a static `0` under reduced motion: `useTransform` is driven by scroll
 *  position, which `MotionConfig` has no control over. */
export function useParallax(speed = 0.08) {
  const ref = useRef<HTMLElement | null>(null)
  const reduced = usePrefersReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const capped = Math.min(Math.abs(speed), 0.12)
  const y = useTransform(scrollYProgress, [0, 1], ['0%', `${capped * 100}%`])
  return { ref, y: reduced ? 0 : y }
}

/** Hover: 2px lift, no scale (§39.3 — a card that grows 4% pushes its neighbours and
 *  reads consumer-app). The CSS `.hover-lift` utility in theme.css is the same
 *  movement for non-Motion elements; this is the variant for Motion components so a
 *  single card never stacks both mechanisms. */
export const hoverLift = {
  rest: { y: 0 },
  hover: { y: -2, transition: { duration: 0.15, ease: EASE_OUT_EXPO } },
} satisfies Variants

/** The arrow inside a pill CTA nudges 3px on hover. Parent sets `whileHover="hover"`. */
export const arrowNudge = {
  rest: { x: 0 },
  hover: { x: 3, transition: { duration: 0.15, ease: EASE_OUT_EXPO } },
} satisfies Variants

/**
 * Counts a real number up once, when it first enters view.
 *
 * Deliberately NOT a generic "animate any number" hook: it takes the resolved value
 * and returns the display value, so it is impossible to count to a fabricated target
 * (principle 7). A `null`/`undefined` value returns `null` and the caller renders
 * nothing rather than a zero.
 *
 * Under reduced motion it returns the final value immediately — the number still has
 * to be readable, the animation is what goes away (§39.4: transitions become instant
 * state changes, never removals).
 */
export function useCountUp(value: number | null | undefined, durationMs = 900) {
  const reduced = usePrefersReducedMotion()
  const [display, setDisplay] = useState<number | null>(value ?? null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (value == null) { setDisplay(null); return }
    if (reduced || !started) { setDisplay(value); return }

    let raf = 0
    const from = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      // Expo-out, matching EASE_OUT_EXPO's character so the count settles like
      // everything else rather than running linear.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs, reduced, started])

  return { display, begin: () => setStarted(true) }
}
