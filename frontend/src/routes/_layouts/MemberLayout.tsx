import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/stores/useAuthStore'

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading">
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  )
}

// The auth guard, checked once here rather than re-implemented per page
// (DESIGN.md §78's auth guard pattern). A client-side redirect is a UX nicety, not a
// security control — every route this wraps still calls a FastAPI endpoint that
// checks entitlement server-side (week1_plan.md Non-negotiable #3).
export default function MemberLayout() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/sign-in" replace />

  return (
    <div id="main">
      <Outlet />
    </div>
  )
}
