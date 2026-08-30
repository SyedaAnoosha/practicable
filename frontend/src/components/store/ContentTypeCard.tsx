import { Link } from 'react-router'
import { BookOpen, CircleCheck, FileDown, Library, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type ContentTypeVariant = 'pack' | 'course' | 'template'

// One component, three variants, because the three content
// types must read as related (same shell) but distinct (own icon/eyebrow/tile).
const VARIANT_META: Record<ContentTypeVariant, { eyebrow: string; icon: LucideIcon; tileClass: string }> = {
  pack: { eyebrow: 'REFERENCE PACK', icon: Library, tileClass: 'bg-accent/12 text-accent' },
  // Courses/templates carry no domain in this data model (only questions do —
  // domainVisuals.ts), so the "domain colour @12%" tile §20.2 specs for these two
  // is stood in for with the brand accent at the same 12% wash — the rule (a tinted
  // tile, full-strength icon) survives even where the exact colour source doesn't apply.
  course: { eyebrow: 'COURSE', icon: BookOpen, tileClass: 'bg-accent/12 text-accent' },
  template: { eyebrow: 'TEMPLATE', icon: FileDown, tileClass: 'bg-gold-soft text-gold-strong' },
}

export interface ContentTypeCardProps {
  variant: ContentTypeVariant
  href: string
  title: string
  /** E.g. "24 questions · PDF · 38 pages" — the shape line, §20.2's second row. */
  subLine: string
  /** Formatted, always with currency (`A$99`) or the word `Free` — never a bare number. */
  price: string
  /** True only when `price` is standing in for "not yet buyable" copy rather than a
   * real price — renders muted instead of the usual tabular-nums price treatment. */
  priceIsPlaceholder?: boolean
  actionLabel: string
  /** Set once the visitor holds this — renders a badge in place of the price and
   * swaps the icon tile's implied state, e.g. "In your library" / "Continue — 45%". */
  ownedBadge?: string
}

/** §20.2: the whole card is ONE link — never a card with a separate link inside it.
 * The action label is therefore text, not a nested `<button>`/`<Link>`. */
export function ContentTypeCard({
  variant,
  href,
  title,
  subLine,
  price,
  priceIsPlaceholder,
  actionLabel,
  ownedBadge,
}: ContentTypeCardProps) {
  const { eyebrow, icon: Icon, tileClass } = VARIANT_META[variant]

  return (
    <Link
      to={href}
      className="group flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-5 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm sm:p-6"
    >
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', tileClass)} aria-hidden="true">
        <Icon className="size-[18px]" />
      </span>

      <div className="flex-1">
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="mt-1.5 text-h3 font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{subLine}</p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        {ownedBadge ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-success px-2 py-0.5 text-xs font-medium text-success-foreground">
            <CircleCheck className="size-3" aria-hidden="true" />
            {ownedBadge}
          </span>
        ) : (
          <span
            className={cn(
              'text-h4 font-semibold tabular-nums text-foreground',
              priceIsPlaceholder && 'text-sm font-normal text-muted-foreground',
            )}
          >
            {price}
          </span>
        )}
        <span className="text-sm font-medium text-accent transition-colors duration-150 group-hover:text-primary">
          {actionLabel}
        </span>
      </div>
    </Link>
  )
}
