import { cn } from '@/lib/utils/cn'

interface AuthorCardProps {
  name: string
  bio?: string | null
  /** Optional avatar URL — falls back to a generated icon. */
  avatarUrl?: string | null
  /** Compact variant for inline use (e.g., sidebar). */
  compact?: boolean
  className?: string
}

/**
 * Author information card. Shows name and bio with a consistent visual treatment.
 *
 * Used on course detail pages and template detail pages where the author's identity
 * adds credibility. The research audit found Practicable had no author presentation
 * anywhere — courses and templates carried an author FK but the public pages never
 * showed who wrote them.
 *
 * Design: uses the existing panel-tone pattern for the avatar area, with the brand
 * primary as the default tone. No domain colour — the author is not scoped to one
 * domain.
 */
export function AuthorCard({
  name,
  bio,
  avatarUrl,
  compact = false,
  className,
}: AuthorCardProps) {
  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Avatar name={name} url={avatarUrl} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          {bio && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{bio}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 sm:p-6',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <Avatar name={name} url={avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Author</p>
          <h3 className="mt-1 text-base font-semibold text-foreground">{name}</h3>
          {bio && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{bio}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** The avatar circle — either an image or a generated initial. */
function Avatar({
  name,
  url,
  size,
}: {
  name: string
  url?: string | null
  size: 'sm' | 'md'
}) {
  const sizeClasses = size === 'sm' ? 'size-9' : 'size-12'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  // Generate a consistent colour from the name
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const hue = hash % 360
  const bgColor = `hsl(${hue}, 35%, 92%)`
  const textColor = `hsl(${hue}, 45%, 35%)`

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={cn(sizeClasses, 'shrink-0 rounded-full object-cover')}
      />
    )
  }

  return (
    <span
      className={cn(
        sizeClasses,
        'flex shrink-0 items-center justify-center rounded-full font-medium',
        textSize,
      )}
      style={{ backgroundColor: bgColor, color: textColor }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
