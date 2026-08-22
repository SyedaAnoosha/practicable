import type { CSSProperties } from 'react'
import { domainColorVar, domainVisual } from '@/lib/domainVisuals'
import { cn } from '@/lib/utils/cn'

/** A stable 0–100 hash of the slug, used as the artwork's horizontal anchor. Two
 *  courses in the same domain get different compositions; the same course always gets
 *  the same one, in every session and on every device, with no stored state. */
function shiftFromSlug(slug: string): number {
  let hash = 0
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 1000
  }
  // Kept to 62–96%: the arc motif is anchored bottom-right by construction (it echoes
  // .stage-aurora), and letting the anchor wander left would put the bright core under
  // the title overlay.
  return 62 + (hash % 34)
}

/**
 * Generative course/pack artwork (design-research §8.2b M3, owner direction 2026-08-20).
 *
 * Replaces the flat provisional `--primary` panel the audit flagged: a duotone ramp from
 * the item's own domain tone into the stage plane, with the concentric-arc "signal
 * found" motif anchored off-canvas bottom-right — the same corner-anchored composition
 * as `.stage-aurora`, so hero, rail, footer and artwork all read as one family.
 *
 * Why generative rather than uploaded-only: the catalogue looks complete from day one,
 * there is no broken-image state, no image request, and it follows a theme swap because
 * every stop is a token. An uploaded `cover_image_url` still wins wherever one exists —
 * this is the floor, not the ceiling. All paint, so `aria-hidden`; the caller supplies
 * the accessible name via the surrounding link or heading.
 */
export function CourseArt({
  slug,
  domain,
  src,
  alt,
  className,
  showIcon = true,
}: {
  slug: string
  /** Full domain name as the API returns it ("Risk (Enterprise & op.)"). Unknown or
   *  absent domains fall back to the brand primary via domainVisual(). */
  domain?: string | null
  /** An uploaded cover image, when one exists — it wins over the generative art. */
  src?: string | null
  alt?: string
  className?: string
  showIcon?: boolean
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? ''}
        className={cn('w-full object-cover', className)}
        loading="lazy"
      />
    )
  }

  const { icon: Icon } = domainVisual(domain ?? '')
  const tone = domainColorVar(domain ?? '')

  return (
    <div
      aria-hidden="true"
      className={cn('art-duotone relative w-full overflow-hidden', className)}
      style={
        {
          '--tone': tone,
          '--art-shift': `${shiftFromSlug(slug)}%`,
        } as CSSProperties
      }
    >
      {showIcon && (
        // The domain icon in a quiet tile, top-left — the one place the artwork says
        // which domain it belongs to without text. Stage-foreground alphas only: this
        // plane is dark in both themes (§7.6).
        <span className="absolute left-3 top-3 flex size-8 items-center justify-center rounded-md bg-stage-foreground/12 text-stage-foreground/85 ring-1 ring-inset ring-stage-foreground/20">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      )}
    </div>
  )
}
