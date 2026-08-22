import { Suspense, lazy } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'

import RootLayout from '@/routes/_layouts/RootLayout'
import MarketingLayout from '@/routes/_layouts/MarketingLayout'
import CatalogueLayout from '@/routes/_layouts/CatalogueLayout'
import AuthLayout from '@/routes/_layouts/AuthLayout'
import MemberLayout from '@/routes/_layouts/MemberLayout'
import AdminLayout from '@/routes/_layouts/AdminLayout'

// ── Eagerly loaded (core public pages, always needed) ──────────────────────
import { Home } from '@/pages/Home'
import { Contact } from '@/pages/Contact'
import { Dashboard } from '@/pages/Dashboard'
import { Library } from '@/pages/Library'
import { Question } from '@/pages/Question'
import { QuestionsCatalogue } from '@/pages/QuestionsCatalogue'
import { CoursesCatalogue } from '@/pages/CoursesCatalogue'
import { CourseDetail } from '@/pages/CourseDetail'
import { TemplatesCatalogue } from '@/pages/TemplatesCatalogue'
import { Store } from '@/pages/Store'
import { PackDetail } from '@/pages/PackDetail'
import { PacksCatalogue } from '@/pages/PacksCatalogue'
import { Terms } from '@/pages/legal/Terms'
import { Privacy } from '@/pages/legal/Privacy'
import { Refunds } from '@/pages/legal/Refunds'
import { SignIn } from '@/pages/SignIn'
import { SignUp } from '@/pages/SignUp'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword } from '@/pages/ResetPassword'
import { AccountShell } from '@/pages/account/AccountShell'
import { AccountProfile } from '@/pages/account/AccountProfile'
import { AccountSecurity } from '@/pages/account/AccountSecurity'
import { AccountPurchases } from '@/pages/account/AccountPurchases'
import { AccountNotifications } from '@/pages/account/AccountNotifications'
import { AccountDataPrivacy } from '@/pages/account/AccountDataPrivacy'

// ── Lazy loaded (heavy, route-specific) ────────────────────────────────────
// §6.3 K3: every route lazy-loaded. Admin bundle never in a learner's download.
// Mux player, rich text editor, and Stripe checkout are dynamically imported.
const Learn = lazy(() => import('@/pages/Learn').then((m) => ({ default: m.Learn })))
const Lesson = lazy(() => import('@/pages/Lesson').then((m) => ({ default: m.Lesson })))
const ProductBuy = lazy(() => import('@/pages/ProductBuy').then((m) => ({ default: m.ProductBuy })))
const CheckoutSuccess = lazy(() => import('@/pages/CheckoutSuccess').then((m) => ({ default: m.CheckoutSuccess })))
const CheckoutCancel = lazy(() => import('@/pages/CheckoutCancel').then((m) => ({ default: m.CheckoutCancel })))
import { Purchases } from '@/pages/Purchases' // eagerly loaded: also imported by AccountPurchases
const Template = lazy(() => import('@/pages/Template').then((m) => ({ default: m.Template })))

// Admin pages — the largest split. Never loaded for non-admin users.
const AdminQuestions = lazy(() => import('@/pages/admin/AdminQuestions').then((m) => ({ default: m.AdminQuestions })))
const AdminTemplates = lazy(() => import('@/pages/admin/AdminTemplates').then((m) => ({ default: m.AdminTemplates })))
const AdminCourses = lazy(() => import('@/pages/admin/AdminCourses').then((m) => ({ default: m.AdminCourses })))
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders').then((m) => ({ default: m.AdminOrders })))
const AdminContact = lazy(() => import('@/pages/admin/AdminContact').then((m) => ({ default: m.AdminContact })))
const AdminMetrics = lazy(() => import('@/pages/admin/AdminMetrics').then((m) => ({ default: m.AdminMetrics })))
const AdminMedia = lazy(() => import('@/pages/admin/AdminMedia').then((m) => ({ default: m.AdminMedia })))
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })))
const AdminAudit = lazy(() => import('@/pages/admin/AdminAudit').then((m) => ({ default: m.AdminAudit })))
const AdminLeads = lazy(() => import('@/pages/admin/AdminLeads').then((m) => ({ default: m.AdminLeads })))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings').then((m) => ({ default: m.AdminSettings })))
const AdminPacks = lazy(() => import('@/pages/admin/AdminPacks').then((m) => ({ default: m.AdminPacks })))
const LessonWriteScreen = lazy(() =>
  import('@/pages/admin/LessonWriteScreen').then((m) => ({ default: m.LessonBodyWriteScreen })),
)
const BlockTextWriteScreen = lazy(() =>
  import('@/pages/admin/LessonWriteScreen').then((m) => ({ default: m.BlockTextWriteScreen })),
)

/** Minimal loading indicator for lazy routes. Kept deliberately lightweight:
 *  no skeleton, no animation, just text — the route should arrive in <200ms. */
function RouteLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  )
}

// react-router v8, data mode.
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <MarketingLayout />,
        // The landing page keeps public chrome even for signed-in visitors — members
        // already have /dashboard as their home.
        children: [
          { path: '/', element: <Home /> },
          // Marketing chrome, not the catalogue sidebar: contact is a public page a
          // visitor reaches from the footer, and a member reaching it mid-session is
          // still asking the business a question rather than browsing content.
          { path: '/contact', element: <Contact /> },
          // Draft legal pages, marketing chrome like Contact above: reachable from the
          // footer, no account needed to read them.
          { path: '/legal/terms', element: <Terms /> },
          { path: '/legal/privacy', element: <Privacy /> },
          { path: '/legal/refunds', element: <Refunds /> },
        ],
      },
      {
        // Public routes a signed-in member also lives in, so they keep the member
        // sidebar rather than dropping back into marketing chrome mid-session.
        element: <CatalogueLayout />,
        children: [
          { path: '/questions', element: <QuestionsCatalogue /> },
          { path: '/questions/:slug', element: <Question /> },
          // Public product/syllabus pages, distinct from /learn/… below: browsing what
          // a course contains before buying needs no account.
          { path: '/courses', element: <CoursesCatalogue /> },
          { path: '/courses/:slug', element: <CourseDetail /> },
          { path: '/templates', element: <TemplatesCatalogue /> },
          { path: '/packs', element: <PacksCatalogue /> },
          // Public: the free lead-magnet template must be reachable with no account.
          // Paid templates here show a buy/sign-in prompt instead of a download.
          { path: '/templates/:templateId', element: <Suspense fallback={<RouteLoading />}><Template /></Suspense> },
          // The storefront: three labelled content types. Individual catalogues above
          // stay reachable directly; /store is the index introducing all three at once.
          { path: '/store', element: <Store /> },
          // The domain-pack product page. Public like every other product page: reading
          // what a pack contains needs no account, and the questions it lists are free.
          { path: '/store/packs/:slug', element: <PackDetail /> },
          // Owner direction 2026-08-16: no standalone pricing page — one-time prices
          // for every product live on /store instead (see Store.tsx's bundle callout
          // and footer). A bare redirect, not a 404, for anyone with the old link.
          { path: '/pricing', element: <Navigate to="/store" replace /> },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          { path: '/sign-in', element: <SignIn /> },
          { path: '/sign-up', element: <SignUp /> },
          { path: '/forgot-password', element: <ForgotPassword /> },
          // Lands here from the emailed link; Supabase's client establishes the
          // recovery session from the URL fragment before this route ever renders
          // (see ResetPassword.tsx's own comment for the full mechanism).
          { path: '/reset-password', element: <ResetPassword /> },
        ],
      },
      {
        element: <MemberLayout />,
        children: [
          { path: '/dashboard', element: <Dashboard /> },
          // Purchased items across all types, with progress and resume.
          { path: '/library', element: <Library /> },
          // The full learning interface. The bare /lessons/:lessonId player stays for
          // any lesson that isn't part of a module/course.
          { path: '/learn/:courseSlug/:lessonSlug', element: <Suspense fallback={<RouteLoading />}><Learn /></Suspense> },
          { path: '/lessons/:lessonId', element: <Suspense fallback={<RouteLoading />}><Lesson /></Suspense> },
          // Account required before purchase, so these share the gated content's guard.
          { path: '/buy/:slug', element: <Suspense fallback={<RouteLoading />}><ProductBuy /></Suspense> },
          { path: '/checkout/success', element: <Suspense fallback={<RouteLoading />}><CheckoutSuccess /></Suspense> },
          { path: '/checkout/cancel', element: <Suspense fallback={<RouteLoading />}><CheckoutCancel /></Suspense> },
          { path: '/purchases', element: <Purchases /> },
          // Phase 10: account shell with routed sub-pages (Decision #44)
          {
            path: '/account',
            element: <AccountShell />,
            children: [
              { index: true, element: <AccountProfile /> },
              { path: 'profile', element: <AccountProfile /> },
              { path: 'security', element: <AccountSecurity /> },
              { path: 'purchases', element: <AccountPurchases /> },
              { path: 'notifications', element: <AccountNotifications /> },
              { path: 'data', element: <AccountDataPrivacy /> },
            ],
          },
        ],
      },
      {
        // The content editor. AdminLayout checks the role for a clean message, but the
        // real boundary is server-side require_admin on every /admin/* route.
        // §6.3 K3: ALL admin pages are lazy — the admin bundle never ships to a learner.
        element: <AdminLayout />,
        children: [
          { path: '/admin', element: <Suspense fallback={<RouteLoading />}><AdminQuestions /></Suspense> },
          { path: '/admin/questions', element: <Suspense fallback={<RouteLoading />}><AdminQuestions /></Suspense> },
          { path: '/admin/courses', element: <Suspense fallback={<RouteLoading />}><AdminCourses /></Suspense> },
          // Full-screen "Write" editor (week4_plan.md Phase 8, 8E-continued,
          // `[OWNER INSTRUCTION 2026-08-21]`) — its own route rather than a modal, so
          // it has Back/Cancel/Save and is reachable/refreshable by URL. Still nested
          // under AdminLayout (keeps the admin nav bar and the is_admin guard, same as
          // every other /admin/* route) — "full screen" means its own routed page, not
          // escaping the admin shell entirely.
          { path: '/admin/courses/:courseId/lessons/:lessonId/write', element: <Suspense fallback={<RouteLoading />}><LessonWriteScreen /></Suspense> },
          { path: '/admin/courses/:courseId/blocks/:blockId/write', element: <Suspense fallback={<RouteLoading />}><BlockTextWriteScreen /></Suspense> },
          { path: '/admin/templates', element: <Suspense fallback={<RouteLoading />}><AdminTemplates /></Suspense> },
          { path: '/admin/packs', element: <Suspense fallback={<RouteLoading />}><AdminPacks /></Suspense> },
          { path: '/admin/media', element: <Suspense fallback={<RouteLoading />}><AdminMedia /></Suspense> },
          { path: '/admin/contact', element: <Suspense fallback={<RouteLoading />}><AdminContact /></Suspense> },
          { path: '/admin/orders', element: <Suspense fallback={<RouteLoading />}><AdminOrders /></Suspense> },
          { path: '/admin/metrics', element: <Suspense fallback={<RouteLoading />}><AdminMetrics /></Suspense> },
          { path: '/admin/users', element: <Suspense fallback={<RouteLoading />}><AdminUsers /></Suspense> },
          { path: '/admin/audit', element: <Suspense fallback={<RouteLoading />}><AdminAudit /></Suspense> },
          { path: '/admin/leads', element: <Suspense fallback={<RouteLoading />}><AdminLeads /></Suspense> },
          { path: '/admin/settings', element: <Suspense fallback={<RouteLoading />}><AdminSettings /></Suspense> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
