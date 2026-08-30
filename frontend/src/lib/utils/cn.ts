import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The custom font-size rungs from `theme.css`'s `@theme` block, registered with
 * tailwind-merge.
 *
 * ⚠ Without this, tailwind-merge classifies a custom rung like `text-h1` as a COLOUR
 * (it matches neither its font-size nor its colour list) and treats it as conflicting
 * with `text-foreground`, silently dropping one. `cn('text-h1 text-foreground')` then
 * returns just `text-foreground` and the `<h1>` renders at inherited body size — no CSS
 * error, clean tsc, only the rendered `className` shows it.
 *
 * Keep in sync with the `--text-*` tokens in theme.css; a missing rung silently stops
 * applying rather than erroring.
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

// The only way to conditionally apply Tailwind classes.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
