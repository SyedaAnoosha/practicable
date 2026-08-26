/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

/* ── Types ──────────────────────────────────────────────────────────────────── */

export type ToastVariant = 'default' | 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  /** Auto-dismiss after this many ms. 0 = manual dismiss only. Default 5000. */
  duration: number
  /** Optional action label + callback shown as a button. */
  action?: { label: string; onClick: () => void }
}

interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
  action?: { label: string; onClick: () => void }
}

/* ── Context ────────────────────────────────────────────────────────────────── */

interface ToastContextValue {
  toasts: Toast[]
  addToast: (input: ToastInput) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let _counter = 0
function nextId() {
  return `toast-${++_counter}-${Date.now()}`
}

/* ── Provider ───────────────────────────────────────────────────────────────── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  // Track timers so we can clean up on unmount or explicit dismiss
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (input: ToastInput): string => {
      const id = nextId()
      const toast: Toast = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? 'default',
        duration: input.duration ?? 5000,
        action: input.action,
      }
      setToasts((prev) => [...prev, toast])

      if (toast.duration > 0) {
        const timer = setTimeout(() => dismiss(id), toast.duration)
        timers.current.set(id, timer)
      }

      return id
    },
    [dismiss],
  )

  const dismissAll = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current.clear()
    setToasts([])
  }, [])

  const value = useMemo(
    () => ({ toasts, addToast, dismiss, dismissAll }),
    [toasts, addToast, dismiss, dismissAll],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

/* ── Hook ───────────────────────────────────────────────────────────────────── */

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>')
  return ctx
}
