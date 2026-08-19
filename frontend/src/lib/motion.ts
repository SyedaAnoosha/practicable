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
