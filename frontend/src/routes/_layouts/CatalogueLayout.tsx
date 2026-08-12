import { useAuthStore } from '@/stores/useAuthStore'
import MarketingLayout from './MarketingLayout'
import { FullPageSpinner, MemberChrome } from './MemberLayout'

/**
 * The layout for pages that are public but that signed-in members also live in:
 * /questions, /questions/:slug, /courses, /courses/:slug, /templates.
 *
 * [FIXED, 2026-08-11 — owner-reported] "Clicking on Courses, Templates and Questions
 * is making the sidebar disappear." These five routes sat under MarketingLayout while
 * the member sidebar that links to them sat under MemberLayout, so every sidebar click
 * navigated out of the layout drawing the sidebar — the member area appeared to end
 * the moment you used its own navigation.
 *
 * Two fixes were possible and one is wrong: moving these routes behind MemberLayout's
 * auth guard would have fixed the sidebar by making the catalogue require an account,
 * which breaks the whole funnel (DESIGN.md §21.3/§27 — browsing before buying is the
 * product's entire top of funnel, and the question body is deliberately free).
 *
 * So the chrome follows the *visitor*, not the route: same page, same URL, same data,
 * wrapped in the member sidebar for someone signed in and in the public header/footer
 * for someone who isn't. Both branches render `<Outlet/>`, so the page component
 * underneath neither knows nor cares which one it got.
 */
export default function CatalogueLayout() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  // Auth state starts `loading: true` and is resolved once in RootLayout. Waiting for
  // it costs a brief spinner, but rendering a guess would mean a visible chrome swap
  // (public header snapping into a sidebar) on every reload of these pages for
  // signed-in users — the more jarring of the two. Same trade MemberLayout makes.
  if (loading) return <FullPageSpinner />

  return user ? <MemberChrome /> : <MarketingLayout />
}
