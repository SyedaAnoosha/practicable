import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/stores/useThemeStore'
import { cn } from '@/lib/utils/cn'

// DESIGN.md §14: an icon-only button always has an aria-label (+ title tooltip),
// and the icon for a concept is fixed across the product — this is the only theme
// switch in the app. Sun/Moon crossfade via opacity/scale so the swap reads as a
// state change (150ms, well inside §39's small-motion band), not a blink.
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'relative inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      <Sun
        aria-hidden="true"
        className={cn(
          'absolute size-4 transition-all duration-150',
          isDark ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
        )}
      />
      <Moon
        aria-hidden="true"
        className={cn(
          'absolute size-4 transition-all duration-150',
          isDark ? 'scale-50 opacity-0' : 'scale-100 opacity-100',
        )}
      />
    </button>
  )
}
