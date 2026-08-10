import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { queryClient } from '@/lib/query/queryClient'
import './styles/theme.css'
import './index.css'
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
