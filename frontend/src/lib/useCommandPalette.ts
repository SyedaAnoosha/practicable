import { useEffect, useState } from 'react'

/**
 * The global ⌘K / Ctrl-K listener that opens the command palette.
 *
 * Lives in `lib/` rather than beside `CommandPalette.tsx` so that file exports only a
 * component: mixing a hook and a component in one module breaks React Fast Refresh
 * (the whole module remounts on edit, losing state), which `react-refresh/
 * only-export-components` exists to prevent.
 *
 * The listener is on `window` and always active while a layout is mounted. It calls
 * `preventDefault` because ⌘K is Chrome's "search from address bar" shortcut, and a
 * palette that opens the browser's UI as well as its own is worse than no palette.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return { open, setOpen }
}
