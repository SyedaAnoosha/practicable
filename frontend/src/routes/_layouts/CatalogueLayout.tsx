import { useAuthStore } from '@/stores/useAuthStore'
import MarketingLayout from './MarketingLayout'
import { FullPageSpinner, MemberChrome } from './MemberLayout'

/**
 * The layout for pages that are public but that signed-in members also live in:
 * /questions, /questions/:slug, /courses, /courses/:slug, /templates.
 *
 * The chrome follows the visitor, not the route: same page, same URL, same data,
 * wrapped in the member sidebar when signed in and the public header/footer when not.
 * Both branches render `<Outlet/>`, so the page underneath neither knows nor cares.
 * Putting these routes under MemberLayout instead would have made the catalogue require
 * an account, breaking the top of the funnel.
 */
export default function CatalogueLayout() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  // Auth state resolves once in RootLayout. Waiting costs a brief spinner, but guessing
  // would mean a visible chrome swap on every reload for signed-in users.
  if (loading) return <FullPageSpinner />

  return user ? <MemberChrome /> : <MarketingLayout />
}
