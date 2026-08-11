import { create } from 'zustand'

export type Theme = 'light' | 'dark'

// Same namespaced key convention as lib EmailGatedBody's 'practicable:email_unlocked'.
const STORAGE_KEY = 'practicable:theme'

// Must stay in sync with the inline script in index.html (which runs before first
// paint to prevent a light→dark flash) and with the --background tokens in theme.css.
const THEME_COLORS: Record<Theme, string> = {
  light: '#FBF9F4',
  dark: '#141008',
}

function readStoredTheme(): Theme | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === 'dark' || raw === 'light' ? raw : null
  } catch {
    // Storage disabled — fall through to the system preference.
    return null
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// DESIGN.md §55: we toggle .dark on <html> and do not follow the OS blindly — the
// OS preference is only the *initial* default for a first-time visitor; the moment
// the user toggles, their choice is persisted and wins from then on (the app never
// re-reacts to OS changes while open).
function initialTheme(): Theme {
  return readStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light')
}

/** The single place the <html> class and the browser-chrome colour are written. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme])
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

// Computed once at module load, used both as the store's initial value and for the
// first applyTheme below — avoids running the localStorage/matchMedia reads twice.
const initial = initialTheme()

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial,
  setTheme: (theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Storage disabled — the choice still applies for this session.
    }
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}))

// Safety net if the index.html inline script is ever removed: applying at module
// load (main.tsx imports this before the first render) still happens before any
// app paint. Idempotent — the inline script may already have run.
applyTheme(initial)
