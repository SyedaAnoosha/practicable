import type { Variants, Transition } from 'motion/react'

/** Shared motion vocabulary, lifted from the Watermelon UI blocks this design follows
 * (hero-1, footer-19, auth-08/10) and from `docs/comps.md`.
 *
 * These live in one file rather than inline per component for the same reason the
 * colour tokens do: the point of the reference blocks is that everything moves with the
 * same weight. Three components each inventing their own duration is how a design
 * system stops reading as one system.
 *
 * Nothing here needs a `prefers-reduced-motion` branch — `<MotionConfig
 * reducedMotion="user">` in main.tsx neutralises transforms tree-wide, and theme.css
 * collapses CSS animation durations. Both are already in place (DESIGN.md §45).
 */

/** Expo-out. The house curve — slow settle, no overshoot.
 *  hero-1 uses [0.16, 1, 0.3, 1]; comps.md's BudgetCard uses [0.19, 1, 0.22, 1].
 *  They are the same gesture; standardised on hero-1's since the hero sets the tone. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

/** Parent for anything that reveals a list of children in sequence.
 *  Stagger and delay are hero-1's values verbatim — they read as deliberate rather
 *  than slow, which is the whole trick with staggered entrances. */
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

/** auth-08's field entrance: a spring rather than a duration, and a shorter 15px rise.
 *  Springs settle at slightly different times per item, which is what stops a stack of
 *  identical form rows from looking like one block sliding up. Pair with
 *  `authStagger` (0.08) rather than the 0.12 used for page-level content. */
export const springItem: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
}

/** Tighter parent for form stacks — auth-08's values. */
export const authStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

/** Standard `whileInView` config. `once: true` matters: a section that re-animates
 *  every time it scrolls back into view is the single most irritating thing about
 *  scroll-triggered motion. `amount: 0.15` fires early enough that the animation is
 *  finishing as the section arrives, rather than starting once it is already read. */
export const inViewOnce = { once: true, amount: 0.15 } as const

/** The header's own entrance — top-level chrome drops in rather than rising, so it
 *  reads as arriving from off-canvas instead of competing with the content below. */
export const headerEnter: Transition = { duration: 0.6, ease: 'easeOut' }
