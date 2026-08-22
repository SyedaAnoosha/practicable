import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The custom font-size rungs defined in `theme.css`'s `@theme` block.
 *
 * ⚠ These MUST be registered with tailwind-merge, and the bug they caused is worth
 * recording because it is silent and it looks like a CSS problem.
 *
 * `tailwind-merge` resolves conflicts by classifying each utility. Out of the box it
 * knows `text-sm`/`text-lg` are font sizes and `text-foreground` is a colour, but a
 * custom rung like `text-h1` matches neither list — so it was classified as a COLOUR
 * and treated as conflicting with `text-foreground`. Whichever came first was dropped.
 *
 * The result: `cn('text-h1 text-foreground')` returned `text-foreground`, and the
 * question page — whose serif editorial headline is the product's stated credibility
 * anchor — rendered its `<h1>` at the inherited 16px, the same size as body text.
 * Every `text-display`, `text-stat` and `text-h*` passed through `cn()` alongside a
 * colour had the same defect. Nothing in the CSS was wrong, tsc was clean, and the
 * classes looked correct in the source; only the rendered `className` showed it.
 *
 * Keep this list in sync with the `--text-*` tokens in theme.css. A rung missing here
 * does not error — it silently stops applying, which is the whole problem.
 */
const FONT_SIZE_RUNGS = [
  'display',
  'outline',
  'h1',
  'h2',
  'h3',
  'h4',
  'stat',
  'lead',
  'read',
  'body',
  'sm',
  'xs',
] as const

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...FONT_SIZE_RUNGS] }],
    },
  },
})

// The only way to conditionally apply Tailwind classes (DESIGN.md §7.2).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
