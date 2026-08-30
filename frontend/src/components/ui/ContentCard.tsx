import { type CSSProperties } from 'react'
import { Link } from 'react-router'
import { CircleCheck, FileText, Layers, Tags } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { domainColorVar, domainVisual } from '@/lib/domainVisuals'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Badge } from '@/components/ui/Badge'
import { Meta, type MetaItem } from '@/components/ui/Meta'
import { CourseArt } from '@/components/ui/CourseArt'

/** The content type — drives icon, colour treatment, and link destination. */
export type ContentKind = 'course' | 'template' | 'question' | 'pack'

interface ContentCardBase {
  kind: ContentKind
  title: string
  description?: string | null
  domain?: string | null
  href: string
  owned?: boolean
  priceCents?: number | null
  currency?: string
  meta?: (MetaItem | null | undefined | false)[]
  coverImageUrl?: string | null
  artSlug?: string
  questionCount?: number
  templateCount?: number
  format?: string | null
  className?: string
}

const KIND_ACTION: Record<ContentKind, { owned: string; browse: string }> = {
  course: { owned: 'Open', browse: 'View course' },
  template: { owned: 'Download', browse: 'See what\'s included' },
  question: { owned: 'Read', browse: 'Read the answer' },
  pack: { owned: 'Download', browse: 'View pack' },
}

function DomainTag({ domain, tone, className }: { domain: string; tone: string; className?: string }) {
  const DomainIcon = domainVisual(domain).icon
  return (
    <p
      className={cn('eyebrow gap-1.5', className)}
      style={{ '--eyebrow-rule-color': tone } as CSSProperties}
    >
      <DomainIcon className="size-3 shrink-0" aria-hidden="true" style={{ color: tone }} />
      {domain}
    </p>
  )
}

/**
 * A unified content card — editorial index entry treatment (top rule, square corners,
 * mono metadata, title underline on hover), matching the Home QuestionCard.
 *
 * The whole card is one `<Link>` (§36); no hover-lift, the title underlines instead.
 * Domain identity is colour + icon + label together, never colour alone (§3.2).
 */
export function ContentCard({
  kind,
  title,
  description,
  domain,
  href,
  owned = false,
  priceCents,
  currency = 'AUD',
  meta = [],
  coverImageUrl,
  artSlug,
  questionCount,
  templateCount,
  format,
  className,
}: ContentCardBase) {
  const tone = domain ? domainColorVar(domain) : undefined
  const action = KIND_ACTION[kind]

  const computedMeta: MetaItem[] = meta.length > 0
    ? (meta.filter(Boolean) as MetaItem[])
    : (() => {
        const items: (MetaItem | null | undefined | false)[] = []
        if (kind === 'template') {
          if (format) items.push({ icon: Layers, value: format })
        } else if (kind === 'pack') {
          if (questionCount != null) items.push({ icon: Tags, value: `${questionCount} question${questionCount === 1 ? '' : 's'}` })
          if (templateCount != null) items.push({ icon: FileText, value: `${templateCount} template${templateCount === 1 ? '' : 's'}` })
        }
        return items.filter(Boolean) as MetaItem[]
      })()

  return (
    <Link
      to={href}
      className={cn(
        'group relative block bg-card transition-colors duration-150',
        // Divided-column treatment: flat background, no border radius.
        // The grid parent supplies the borders via gap-px + bg-border.
        // Fallback border for when used outside a divided grid.
        'border border-border sm:border-0',
        className,
      )}
    >
      {/* The domain rule: 2px across the top, full bleed. Same treatment as the
          Home QuestionCard — the single most effective domain signal after re-hue.
          Thickens slightly on hover rather than the card moving. */}
      {tone && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 transition-[height] duration-150 group-hover:h-[3px]"
          style={{ backgroundColor: tone }}
        />
      )}

      {/* Course: artwork + content */}
      {kind === 'course' && (
        <>
          {coverImageUrl || artSlug ? (
            <CourseArt
              slug={artSlug ?? ''}
              domain={domain ?? ''}
              src={coverImageUrl}
              alt={`Cover image for ${title}`}
              className="aspect-[16/9]"
            />
          ) : null}
          <div className="px-4 pt-3 pb-4">
            {domain && tone && <DomainTag domain={domain} tone={tone} />}
            <h3 className="mt-1.5 text-sm font-semibold text-foreground decoration-1 underline-offset-4 group-hover:underline">
              {title}
            </h3>
            {description && (
              <p className="mt-1 line-clamp-2 font-serif text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
            {computedMeta.length > 0 && (
              <Meta className="mt-2" tone={tone} items={computedMeta} />
            )}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
              {owned ? (
                <Badge variant="success" className="gap-1 text-[0.625rem]">
                  <CircleCheck className="size-2.5" aria-hidden="true" />
                  Owned
                </Badge>
              ) : priceCents != null ? (
                <span className="font-mono text-xs tabular-nums text-foreground">
                  {formatCurrency(priceCents, currency)}
                </span>
              ) : <span />}
              <span className="text-xs font-medium text-accent">
                {owned ? action.owned : action.browse}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Template: format badge + content */}
      {kind === 'template' && (
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center gap-2">
            {format && (
              <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.625rem] font-medium tracking-wide text-muted-foreground">
                {format}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-foreground decoration-1 underline-offset-4 group-hover:underline">
            {title}
          </h3>
          {description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {description}
            </p>
          )}
          {computedMeta.length > 0 && (
            <Meta className="mt-2" items={computedMeta} />
          )}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
            {owned ? (
              <Badge variant="success" className="gap-1 text-[0.625rem]">
                <CircleCheck className="size-2.5" aria-hidden="true" />
                Owned
              </Badge>
            ) : priceCents != null ? (
              <span className="font-mono text-xs tabular-nums text-foreground">
                {formatCurrency(priceCents, currency)}
              </span>
            ) : <span />}
            <span className="text-xs font-medium text-accent">
              {owned ? action.owned : action.browse}
            </span>
          </div>
        </div>
      )}

      {/* Question: domain eyebrow + content */}
      {kind === 'question' && (
        <div className="px-4 pt-3 pb-4">
          {domain && tone && <DomainTag domain={domain} tone={tone} />}
          <h3 className="mt-1.5 text-sm font-semibold text-foreground decoration-1 underline-offset-4 group-hover:underline">
            {title}
          </h3>
          {description && (
            <p className="mt-1 line-clamp-2 font-serif text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
          {computedMeta.length > 0 && (
            <Meta className="mt-2" items={computedMeta} />
          )}
        </div>
      )}

      {/* Pack: artwork + domain label + content */}
      {kind === 'pack' && (
        <>
        {/* Artwork was gated on
            `kind === 'course'`, so a pack card rendered text-only beside an
            illustrated course card in the same grid. `CourseArt` is documented as
            "course/pack artwork" — packs were always in scope.

            Still conditional on having something to draw with: a caller that passes
            neither `artSlug` nor `coverImageUrl` gets the previous text-only card
            rather than an empty 16:9 band. */}
        {(coverImageUrl || artSlug) && (
          <CourseArt
            slug={artSlug ?? ''}
            domain={domain ?? ''}
            src={coverImageUrl}
            alt={`Cover image for ${title}`}
            className="aspect-[16/9]"
          />
        )}
        <div className="px-4 pt-3 pb-4">
          {domain && tone && <DomainTag domain={domain} tone={tone} />}
          <h3 className="mt-1.5 text-sm font-semibold text-foreground decoration-1 underline-offset-4 group-hover:underline">
            {title}
          </h3>
          {description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {description}
            </p>
          )}
          {computedMeta.length > 0 && (
            <Meta className="mt-2" items={computedMeta} />
          )}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
            {owned ? (
              <Badge variant="success" className="gap-1 text-[0.625rem]">
                <CircleCheck className="size-2.5" aria-hidden="true" />
                Owned
              </Badge>
            ) : priceCents != null ? (
              <span className="font-mono text-xs tabular-nums text-foreground">
                {formatCurrency(priceCents, currency)}
              </span>
            ) : <span />}
            <span className="text-xs font-medium text-accent">
              {owned ? action.owned : action.browse}
            </span>
          </div>
        </div>
        </>
      )}
    </Link>
  )
}
