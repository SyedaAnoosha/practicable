import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { ChevronDown, FileText, GraduationCap, Layers, Package, Tags } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * The Products dropdown in the marketing header: a disclosure button over a list of
 * links, NOT a `role="menu"` menubar (that pattern is for application commands and
 * strips the affordances that make a link a link — every item stays an `<a>`).
 *
 * Opens on click and on hover-with-intent; Escape closes and returns focus to the
 * trigger; outside click and Tab-out close it. Motion: opacity + 4px rise, opacity-only
 * under prefers-reduced-motion.
 */

const PRODUCT_ITEMS = [
  { to: '/questions', label: 'Questions', description: 'Free to read', icon: Tags },
  { to: '/courses', label: 'Courses', description: 'Structured learning paths', icon: GraduationCap },
  { to: '/templates', label: 'Templates', description: 'Working files you keep', icon: FileText },
  { to: '/packs', label: 'Reference packs', description: 'Domain-specific bundles', icon: Package },
  { to: '/store', label: 'All products', description: 'Everything in the store', icon: Layers },
] as const

export function ProductsMenu() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Real pointer devices hover the trigger before clicking it — hover opens the menu
  // first, then a `setOpen(v => !v)` toggle would close the very thing hover just
  // opened. Tracked separately so a click always means "stay open, this was
  // deliberate," never "undo the hover."
  const openedByClickRef = useRef(false)

  // Close on Escape, return focus to trigger
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        openedByClickRef.current = false
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Hover-with-intent: a short delay before opening, so passing over the trigger on
  // the way to something else doesn't pop the menu open. Closes after a longer delay
  // so moving from the trigger to the menu itself doesn't close it in transit.
  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    openTimeoutRef.current = setTimeout(() => setOpen(true), 150)
  }
  const handleMouseLeave = () => {
    if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(() => {
      setOpen(false)
      openedByClickRef.current = false
    }, 150)
  }

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls="products-menu"
        onClick={() => {
          if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
          if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current)
          // A click that opens (whether the menu was already open from hover or
          // closed) is always "stay open" — only a click while already open BY
          // CLICK closes it, so a second deliberate click still toggles for anyone
          // navigating by click alone rather than hover.
          if (open && openedByClickRef.current) {
            setOpen(false)
            openedByClickRef.current = false
          } else {
            setOpen(true)
            openedByClickRef.current = true
          }
        }}
        className={cn(
          'flex items-center gap-1.5 text-sm transition-colors duration-150',
          open
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Products
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform duration-150',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id="products-menu"
          role="region"
          aria-label="Products"
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-card p-2 shadow-lg animate-in fade-in slide-in-from-top-1"
          style={{
            animationDuration: '150ms',
            animationTimingFunction: 'var(--ease-standard)',
          }}
        >
          {PRODUCT_ITEMS.map(({ to, label, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-muted"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
