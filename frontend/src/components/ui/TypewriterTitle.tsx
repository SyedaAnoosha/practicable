import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils/cn'

/** Typewriter headline.
 *
 * Reduced motion is handled explicitly: `<MotionConfig reducedMotion="user">` only
 * neutralises transform animations, not a setTimeout loop retyping text, so under
 * reduced motion the full text renders immediately instead.
 *
 * Accessibility: the animated text is `aria-hidden` and the complete phrase is exposed
 * to assistive tech in a visually-hidden span — a screen reader announcing a headline
 * one character at a time is not a headline.
 */

export type TypewriterSequence = {
  text: string
  deleteAfter?: boolean
  pauseAfter?: number
}

type TypewriterTitleProps = {
  sequences: TypewriterSequence[]
  typingSpeed?: number
  startDelay?: number
  autoLoop?: boolean
  loopDelay?: number
  deleteSpeed?: number
  pauseBeforeDelete?: number
  naturalVariance?: boolean
  className?: string
  /** What assistive tech reads instead of the animation. Defaults to every sequence
   *  joined, which is right when the phrases are alternatives rather than a sentence. */
  srLabel?: string
}

export function TypewriterTitle({
  sequences,
  typingSpeed = 50,
  startDelay = 200,
  autoLoop = true,
  loopDelay = 1000,
  deleteSpeed = 30,
  pauseBeforeDelete = 1000,
  naturalVariance = true,
  className,
  srLabel,
}: TypewriterTitleProps) {
  const reduced = useReducedMotion()
  const [displayText, setDisplayText] = useState('')
  const sequenceIndexRef = useRef(0)
  const charIndexRef = useRef(0)
  const isDeletingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sequencesRef = useRef(sequences)
  useEffect(() => {
    sequencesRef.current = sequences
  }, [sequences])

  useEffect(() => {
    // Reduced motion: show the first phrase in full and never animate.
    if (reduced) {
      setDisplayText(sequencesRef.current[0]?.text ?? '')
      return
    }

    const getTypingDelay = () => {
      if (!naturalVariance) return typingSpeed
      const random = Math.random()
      if (random < 0.1) return typingSpeed * 2 // hesitation
      if (random > 0.9) return typingSpeed * 0.5 // burst
      const variance = 0.4
      const min = typingSpeed * (1 - variance)
      const max = typingSpeed * (1 + variance)
      return Math.random() * (max - min) + min
    }

    const run = () => {
      const current = sequencesRef.current[sequenceIndexRef.current]
      if (!current) return

      if (isDeletingRef.current) {
        if (charIndexRef.current > 0) {
          charIndexRef.current -= 1
          setDisplayText(current.text.slice(0, charIndexRef.current))
          timeoutRef.current = setTimeout(run, deleteSpeed)
        } else {
          isDeletingRef.current = false
          const isLast = sequenceIndexRef.current === sequencesRef.current.length - 1
          if (isLast && autoLoop) {
            timeoutRef.current = setTimeout(() => {
              sequenceIndexRef.current = 0
              run()
            }, loopDelay)
          } else if (!isLast) {
            timeoutRef.current = setTimeout(() => {
              sequenceIndexRef.current += 1
              run()
            }, 100)
          }
        }
      } else if (charIndexRef.current < current.text.length) {
        charIndexRef.current += 1
        setDisplayText(current.text.slice(0, charIndexRef.current))
        timeoutRef.current = setTimeout(run, getTypingDelay())
      } else {
        const pause = current.pauseAfter ?? pauseBeforeDelete
        if (current.deleteAfter) {
          timeoutRef.current = setTimeout(() => {
            isDeletingRef.current = true
            run()
          }, pause)
        } else {
          const isLast = sequenceIndexRef.current === sequencesRef.current.length - 1
          if (isLast && autoLoop) {
            timeoutRef.current = setTimeout(() => {
              sequenceIndexRef.current = 0
              charIndexRef.current = 0
              setDisplayText('')
              run()
            }, loopDelay)
          } else if (!isLast) {
            timeoutRef.current = setTimeout(() => {
              sequenceIndexRef.current += 1
              charIndexRef.current = 0
              setDisplayText('')
              run()
            }, pause)
          }
        }
      }
    }

    timeoutRef.current = setTimeout(run, startDelay)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [
    reduced,
    typingSpeed,
    deleteSpeed,
    pauseBeforeDelete,
    autoLoop,
    loopDelay,
    startDelay,
    naturalVariance,
  ])

  return (
    <span className={cn('inline-flex items-baseline gap-1', className)}>
      <span className="sr-only">{srLabel ?? sequences.map((s) => s.text).join(', ')}</span>
      <span aria-hidden="true" className="inline-block min-h-[1.1em] min-w-[0.5em]">
        {displayText}
      </span>
      {!reduced && (
        <motion.span
          aria-hidden="true"
          className="inline-block h-[0.85em] w-[3px] bg-accent"
          animate={{ opacity: [1, 1, 0, 0] }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, repeatType: 'loop', ease: 'linear' }}
        />
      )}
    </span>
  )
}
