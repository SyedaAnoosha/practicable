import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { queryClient } from '@/lib/query/queryClient'
// index.css/App.css were the unmodified create-vite starter boilerplate (its own
// --text-h colour system, a raw unlayered `h1 { color: var(--text-h) }` rule that
// silently beat every Tailwind text-foreground utility in the app — Tailwind v4's
// utilities live in @layer, and unlayered CSS always wins the cascade regardless of
// specificity or source order). Deleted; theme.css + Tailwind's own Preflight are the
// only global stylesheet this app has now.
import './styles/theme.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Respects prefers-reduced-motion tree-wide (DESIGN.md §45) */}
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MotionConfig>
  </StrictMode>,
)
