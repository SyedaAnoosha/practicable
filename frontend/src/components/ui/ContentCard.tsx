import { type CSSProperties } from 'react'
import { Link } from 'react-router'
import { CircleCheck, FileText, GraduationCap, Layers, Tags, type LucideIcon } from 'lucide-react'
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
  /** Display title. */
  title: string
  /** Short description or subtitle. */
  description?: string | null
  /** Domain name for colour and icon. */
  domain?: string | null
  /** Link destination. */
  href: string
  /** Whether the current user already owns this. */
  owned?: boolean
  /** Price in cents. Null for free items. */
  priceCents?: number | null
  /** Currency code. */
  currency?: string
  /** Optional metadata items to show below the description. */
  meta?: (MetaItem | null | undefined | false)[]
  /** Course-specific: cover image URL. */
  coverImageUrl?: string | null
  /** Course-specific: slug for generative art fallback. */
  artSlug?: string
  /** Pack-specific: number of questions. */
  questionCount?: number
  /** Pack-specific: number of templates. */
  templateCount?: number
  /** Template-specific: file format string. */
  format?: string | null
  /** Additional CSS classes. */
  className?: string
}

const KIND_ICON: Record<ContentKind, LucideIcon> = {
  course: GraduationCap,
  template: FileText,
  question: Tags,
  pack: Layers,
}

const KIND_ACTION: Record<ContentKind, { owned: string; browse: string }> = {
  course: { owned: 'Open', browse: 'View course' },
  template: { owned: 'Download', browse: 'See what\'s included' },
  question: { owned: 'Read', browse: 'Read the answer' },
  pack: { owned: 'Download', browse: 'View pack' },
}

/**
 * The domain signal: colour + icon + label, always together.
 *
 * ⚠ This is an ACCESSIBILITY REQUIREMENT, not a style choice, and it is why the
 * component exists rather than each card branch inlining its own eyebrow.
 *
 * Measured 2026-08-22 (REDESIGN_SUMMARY.md §3.2): simulating protanopia, deuteranopia
 * and tritanopia over all ten pairs of the five domain colours, the worst pair
 * separates at 1.04:1 — effectively identical. An exhaustive search over ~81,000
 * five-hue combinations inside the contrast-legal envelope could not beat 1.08:1. No
 * five-hue palette survives dichromacy on hue alone, so the re-hue alone would have
 * improved the palette for most users while leaving colour-blind users exactly where
 * they started.
 *
 * The icon here is the DOMAIN's icon (ShieldAlert / Radar / ClipboardCheck / Activity
 * / Sparkles from domainVisuals), deliberately not the content KIND's icon — the kind
 * is already conveyed by the card's shape, its artwork and its action verb, whereas
 * the domain previously had colour and nothing else.
 */
function PackDomainIcon({ domain }: { domain: string }) {
  const DomainIcon = domainVisual(domain).icon
  return <DomainIcon className="size-4" aria-hidden="true" />
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
 * A unified content card with domain colour treatment, metadata row, and
 * access/price state. Used across catalogues, related-rail, and home.
 *
 * Design system references:
 * - Domain left-rule: M3 (domain identity) from design-research
 * - Meta row: M5 (metadata richness) — DataCamp-style fact strip
 * - Hover lift: §39.3 (2px, no scale)
 * - Gold tile: for template artefacts (§7 finding 4)
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
  const Icon = KIND_ICON[kind]
  const action = KIND_ACTION[kind]

  // Build metadata from props if not explicitly provided
  const computedMeta: MetaItem[] = meta.length > 0
    ? (meta.filter(Boolean) as MetaItem[])
    : (() => {
        const items: (MetaItem | null | undefined | false)[] = []
        if (kind === 'course') {
          // Course meta is typically passed explicitly (module/lesson counts)
        } else if (kind === 'template') {
          if (format) items.push({ icon: Layers, value: format })
        } else if (kind === 'pack') {
          if (questionCount != null) items.push({ icon: Tags, value: `${questionCount} question${questionCount === 1 ? '' : 's'}` })
          if (templateCount != null) items.push({ icon: FileText, value: `${templateCount} template${templateCount === 1 ? '' : 's'}` })
        }
        return items.filter(Boolean) as MetaItem[]
      })()

  return (
    <Link to={href} className="group">
      <div
        className={cn(
          'hover-lift hover-lift-domain flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card',
          // Domain left-rule for course/pack; plain border for template/question
          (kind === 'course' || kind === 'pack') && 'border-l-4',
          className,
        )}
        style={
          tone
            ? { borderLeftColor: tone, '--card-domain-color': tone } as CSSProperties
            : undefined
        }
      >
        {/* Course cover image or generative art */}
        {kind === 'course' && (
          <CourseArt
            slug={artSlug ?? ''}
            domain={domain ?? ''}
            src={coverImageUrl}
            alt={`Cover image for ${title}`}
            className="aspect-[16/9]"
          />
        )}

        {/* Template gold tile header */}
        {kind === 'template' && (
          <div className="flex items-center gap-3 border-b border-border px-5 pt-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            {format && (
              <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium tracking-wide text-muted-foreground">
                {format}
              </span>
            )}
          </div>
        )}

        {/* Question domain eyebrow */}
        {kind === 'question' && domain && tone && (
          <div className="border-b border-border px-5 pt-4">
            <DomainTag domain={domain} tone={tone} />
          </div>
        )}

        {/* Pack icon header */}
        {kind === 'pack' && (
          <div className="flex items-center gap-3 px-5 pt-4">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-md"
              style={tone ? { backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)`, color: tone } : undefined}
            >
              {/* Domain icon, not the pack icon: "this is a pack" is already carried by
                  the card's action verb and its question/template counts. */}
              {domain ? <PackDomainIcon domain={domain} /> : <Icon className="size-4" aria-hidden="true" />}
            </span>
            {domain && (
              <p className="text-xs font-medium" style={{ color: tone }}>{domain}</p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 flex-col p-5">
          {/* Eyebrow for course and pack (template has its own above) */}
          {/* Courses previously showed the domain NAME with no icon and packs showed
              their eyebrow twice. Both now use the one signal. */}
          {kind === 'course' && domain && tone && <DomainTag domain={domain} tone={tone} />}

          <h3 className={cn(
            'text-h4 font-semibold text-foreground',
            (kind === 'course' || kind === 'pack') && 'mt-2',
            kind === 'template' && 'mt-3',
            kind === 'question' && 'mt-2',
          )}>
            {title}
          </h3>

          {description && (
            <p className={cn(
              'line-clamp-2 text-sm text-muted-foreground',
              kind === 'course' && 'mt-1.5 font-serif',
              kind !== 'course' && 'mt-1.5',
            )}>
              {description}
            </p>
          )}

          {/* Meta row */}
          {computedMeta.length > 0 && (
            <Meta className="mt-3" tone={tone} items={computedMeta} />
          )}

          {/* Footer: access state + action */}
          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            {owned ? (
              <Badge variant="success" className="gap-1">
                <CircleCheck className="size-3" aria-hidden="true" />
                In your library
              </Badge>
            ) : priceCents != null ? (
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {formatCurrency(priceCents, currency)}
              </p>
            ) : (
              <span />
            )}

            <span className="shrink-0 text-sm font-medium text-accent group-hover:underline">
              {owned ? action.owned : action.browse}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
