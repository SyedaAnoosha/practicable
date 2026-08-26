import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'
import { useToast, type Toast, type ToastVariant } from '@/stores/useToastStore'
import { cn } from '@/lib/utils/cn'

/* ── Variant styles ─────────────────────────────────────────────────────────── */

const variantStyles: Record<
  ToastVariant,
  { container: string; icon: string; iconEl: React.ReactNode }
> = {
  default: {
    container: 'border-border bg-card text-card-foreground',
    icon: 'text-muted-foreground',
    iconEl: null,
  },
  success: {
    container: 'border-success/30 bg-success/5 text-foreground',
    icon: 'text-success',
    iconEl: <CheckCircle2 className="size-4 shrink-0 text-success" />,
  },
  error: {
    container: 'border-destructive/30 bg-destructive/5 text-foreground',
    icon: 'text-destructive',
    iconEl: <AlertCircle className="size-4 shrink-0 text-destructive" />,
  },
  info: {
    container: 'border-accent/30 bg-accent/5 text-foreground',
    icon: 'text-accent',
    iconEl: <Info className="size-4 shrink-0 text-accent" />,
  },
  warning: {
    container: 'border-warning/30 bg-warning/5 text-foreground',
    icon: 'text-warning',
    iconEl: <AlertTriangle className="size-4 shrink-0 text-warning" />,
  },
}

/* ── Single toast item ──────────────────────────────────────────────────────── */

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const vs = variantStyles[toast.variant]

  // Animate in on mount
  useEffect(() => {
    // Force a frame so the initial state is rendered before the transition
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto w-full max-w-sm rounded-lg border p-4 shadow-lg',
        'transition-all duration-200 ease-in-out',
        vs.container,
        visible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-4 opacity-0',
        'motion-reduce:transition-none',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="mt-0.5">{vs.iconEl}</div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{toast.title}</p>
          {toast.description && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium text-accent underline-offset-2 hover:underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Dismiss notification"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ── Toast container (portal) ───────────────────────────────────────────────── */

export function Toaster() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return createPortal(
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col items-center gap-2 p-4 sm:bottom-4 sm:items-end"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>,
    document.body,
  )
}
