import { cn } from '@/lib/utils/cn'

/** The pulsing status dot + label that opens a section.
 *
 * Appears in three of the six reference blocks — footer-7 (an orange ping), footer-19
 * (a violet dot with a glow shadow) and contact-7 (a flat primary dot in a pill) — which
 * is what makes it a device worth extracting rather than copying three times.
 *
 * Adapted rather than pasted: the originals hardcode their accent (`bg-[#FF4202]`,
 * `bg-violet-600`) against a near-black ground. Here it takes the project's accent so it
 * stays inside the two-colour palette, and `--gold` is available for the warmer case.
 *
 * The ping ring is `animate-ping`, a CSS animation — theme.css's reduced-motion block
 * collapses its duration globally, so no per-component guard is needed.
 */
export function StatusDot({
  label,
  tone = 'accent',
  on = 'surface',
  className,
}: {
  label: string
  tone?: 'accent' | 'gold' | 'success'
  /** Which plane this sits on. `stage` is the dark full-bleed plane (hero, auth panel,
   *  footer); `surface` is the ordinary page ground. It only affects the gold tone —
   *  `--gold-strong` is the *text-safe* shade, which is dark antique in the light theme
   *  and therefore all but invisible as a dot on navy. The dot is decorative, never
   *  text, so on the stage it takes the bright `--gold` instead. */
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
        {/* Two stacked spans, not one with a box-shadow: the outer ring has to scale and
            fade independently of the solid centre, which a shadow cannot do. */}
        <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-75', dot)} />
        <span className={cn('relative inline-flex size-2 rounded-full', dot)} />
      </span>
      {/* Inherits its colour rather than pinning `text-foreground`, which is near-black
          espresso in the light theme — on the dark stage this label was rendering
          invisible (reported from a light-mode auth screenshot, 2026-08-13). Every
          consumer already sets a foreground on its own plane; the label just follows. */}
      <span className="text-sm font-medium tracking-wide">{label}</span>
    </div>
  )
}
