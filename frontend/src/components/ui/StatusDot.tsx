import { cn } from '@/lib/utils/cn'

/** The pulsing status dot + label that opens a section. Takes the project's accent
 * colours rather than a hardcoded one, staying inside the two-colour palette. The ping
 * ring is `animate-ping`, a CSS animation collapsed globally by theme.css's
 * reduced-motion block, so no per-component guard is needed.
 */
export function StatusDot({
  label,
  tone = 'accent',
  on = 'surface',
  className,
}: {
  label: string
  tone?: 'accent' | 'gold' | 'success'
  /** Which plane this sits on. Only affects the gold tone: `--gold-strong` is dark
   * antique in the light theme and nearly invisible as a dot on the dark `stage`
   * plane, so stage uses the bright `--gold` instead. */
  on?: 'surface' | 'stage'
  className?: string
}) {
  const dot = {
    accent: 'bg-accent',
    gold: on === 'stage' ? 'bg-gold' : 'bg-gold-strong',
    success: 'bg-success',
  }[tone]

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="relative flex size-2 shrink-0" aria-hidden="true">
        {/* Two stacked spans: the outer ring scales and fades independently of the
            solid centre, which a shadow can't do. */}
        <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-75', dot)} />
        <span className={cn('relative inline-flex size-2 rounded-full', dot)} />
      </span>
      {/* Inherits its colour rather than pinning `text-foreground`, which would render
          invisible on the dark stage plane. Every consumer sets its own foreground. */}
      <span className="text-sm font-medium tracking-wide">{label}</span>
    </div>
  )
}
