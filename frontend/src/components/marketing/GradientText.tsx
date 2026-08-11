import type { ReactNode } from 'react'
import { motion } from 'motion/react'

// A reactbits-style animated gradient/shimmer text treatment for the one emphasised
// phrase in the hero headline. Text content stays real text (not an image or SVG), so
// it remains selectable and reads correctly to screen readers — only the paint
// shimmers, nothing about the semantics changes.
export function GradientText({ children }: { children: ReactNode }) {
  return (
    <motion.span
      className="bg-clip-text text-transparent"
      style={{
        backgroundImage:
          'linear-gradient(90deg, var(--chart-1), var(--chart-2), var(--chart-3), var(--chart-1))',
        backgroundSize: '300% 100%',
      }}
      animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
      transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
    >
      {children}
    </motion.span>
  )
}
