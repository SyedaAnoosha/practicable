import { motion } from 'motion/react'

// A reactbits-style "aurora" ambient background: three large, blurred, slowly
// drifting colour blobs behind the hero content. Built on `motion` (already a
// dependency) rather than pulling in an external reactbits package, since reactbits
// itself ships as copy-paste source, not an installable library — this reproduces the
// same effect using tokens already defined in theme.css so it still adapts if the
// palette or dark mode changes.
//
// This is a deliberate departure from DESIGN.md §18.2 ("No hero image. No
// gradient."), done on the owner's explicit direction — the brief there predates the
// "looks only white, use colour" feedback. `MotionConfig reducedMotion="user"` (set
// once in main.tsx) automatically freezes these loops for anyone with
// prefers-reduced-motion, so this doesn't reintroduce a motion-sensitivity issue.
const BLOBS = [
  { color: 'var(--chart-1)', size: 520, top: '-12%', left: '4%', duration: 22 },
  { color: 'var(--chart-2)', size: 460, top: '8%', left: '58%', duration: 26 },
  { color: 'var(--chart-3)', size: 400, top: '38%', left: '22%', duration: 30 },
] as const

export function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {BLOBS.map((blob, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full opacity-40 blur-3xl"
          style={{
            width: blob.size,
            height: blob.size,
            top: blob.top,
            left: blob.left,
            background: blob.color,
          }}
          animate={{
            x: [0, 40, -20, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.08, 0.96, 1],
          }}
          transition={{
            duration: blob.duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
      {/* Fades the wash back to the page background at the edges so it reads as
          ambient colour, not a hard-edged banner. */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 0%, var(--background) 85%)' }}
      />
    </div>
  )
}
