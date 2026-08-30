import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface Preview {
  url: string
  alt: string
}

interface PreviewGalleryProps {
  previews: Preview[]
  title: string
}

/** Two real preview images, lightboxable. The lightbox is
 * hand-rolled to `RefundDialog`'s existing accessible-overlay pattern (no Radix
 * dependency in this project): focus trapped, Escape closes, focus returns to the
 * thumbnail that opened it. Arrow keys move between images, which RefundDialog has no
 * need for since it's a single view. */
export const PreviewGallery = ({ previews, title }: PreviewGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerElement = useRef<Element | null>(null)
  const titleId = useId()

  const openLightbox = (index: number) => {
    triggerElement.current = document.activeElement
    setSelectedIndex(index)
  }
  const closeLightbox = () => setSelectedIndex(null)

  useEffect(() => {
    if (selectedIndex === null) return

    closeButtonRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox()
        return
      }
      if (e.key === 'ArrowRight') {
        setSelectedIndex((i) => (i === null ? i : (i + 1) % previews.length))
        return
      }
      if (e.key === 'ArrowLeft') {
        setSelectedIndex((i) => (i === null ? i : (i - 1 + previews.length) % previews.length))
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (triggerElement.current instanceof HTMLElement) triggerElement.current.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex !== null])

  if (previews.length === 0) return null

  const active = selectedIndex !== null ? previews[selectedIndex] : null

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4" role="group" aria-label={`Sample pages from ${title}`}>
        {previews.map((preview, index) => (
          <button
            key={preview.url}
            type="button"
            onClick={() => openLightbox(index)}
            className={cn(
              'group relative aspect-[3/4] overflow-hidden rounded-md border border-border bg-muted p-3',
              'transition-all duration-150 ease-[var(--ease-standard,ease-out)]',
              'hover:-translate-y-0.5 hover:shadow-md',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            {/* §16.3: a light plate behind the document page in dark mode, never a CSS
                filter — the `bg-muted p-3` on the button above is that plate; a
                document page is usually white, and the plate keeps it legible without
                distorting its actual colours. */}
            <img
              src={preview.url}
              alt={preview.alt}
              className="size-full rounded-sm object-cover object-top"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {active && selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--stage,rgba(0,0,0,0.8))]/80 p-4"
          onClick={closeLightbox}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative max-h-[90vh] max-w-[90vw] rounded-lg shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <span id={titleId} className="sr-only">
              {active.alt || `Preview image ${selectedIndex + 1} of ${previews.length}`}
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              className="absolute -top-3 -right-3 rounded-full bg-card p-1.5 text-foreground shadow-md hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              onClick={closeLightbox}
              aria-label="Close preview"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <img
              src={active.url}
              alt={active.alt}
              decoding="async"
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {active.alt || `Page ${selectedIndex + 1} of ${previews.length}`}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
