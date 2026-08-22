import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'

import RootLayout from '@/routes/_layouts/RootLayout'
import MarketingLayout from '@/routes/_layouts/MarketingLayout'
import CatalogueLayout from '@/routes/_layouts/CatalogueLayout'
import AuthLayout from '@/routes/_layouts/AuthLayout'
import MemberLayout from '@/routes/_layouts/MemberLayout'
import AdminLayout from '@/routes/_layouts/AdminLayout'

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
import { Terms } from '@/pages/legal/Terms'
import { Privacy } from '@/pages/legal/Privacy'
import { Refunds } from '@/pages/legal/Refunds'
import { SignIn } from '@/pages/SignIn'
import { SignUp } from '@/pages/SignUp'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword } from '@/pages/ResetPassword'
import { Lesson } from '@/pages/Lesson'
import { Learn } from '@/pages/Learn'
import { Template } from '@/pages/Template'
import { ProductBuy } from '@/pages/ProductBuy'
import { CheckoutSuccess } from '@/pages/CheckoutSuccess'
import { CheckoutCancel } from '@/pages/CheckoutCancel'
import { AdminQuestions } from '@/pages/admin/AdminQuestions'
import { AdminTemplates } from '@/pages/admin/AdminTemplates'
import { AdminCourses } from '@/pages/admin/AdminCourses'
import { LessonBodyWriteScreen, BlockTextWriteScreen } from '@/pages/admin/LessonWriteScreen'
import { AdminOrders } from '@/pages/admin/AdminOrders'
import { AdminContact } from '@/pages/admin/AdminContact'
import { AdminMetrics } from '@/pages/admin/AdminMetrics'
import { AdminMedia } from '@/pages/admin/AdminMedia'
import { AdminUsers } from '@/pages/admin/AdminUsers'
import { AdminAudit } from '@/pages/admin/AdminAudit'
import { AdminLeads } from '@/pages/admin/AdminLeads'
import { AdminSettings } from '@/pages/admin/AdminSettings'
import { AdminPacks } from '@/pages/admin/AdminPacks'
import { PacksCatalogue } from '@/pages/PacksCatalogue'
import { Purchases } from '@/pages/Purchases'
import { AccountShell } from '@/pages/account/AccountShell'
import { AccountProfile } from '@/pages/account/AccountProfile'
import { AccountSecurity } from '@/pages/account/AccountSecurity'
import { AccountPurchases } from '@/pages/account/AccountPurchases'
import { AccountNotifications } from '@/pages/account/AccountNotifications'
import { AccountDataPrivacy } from '@/pages/account/AccountDataPrivacy'

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
          { path: '/templates/:templateId', element: <Template /> },
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
          { path: '/learn/:courseSlug/:lessonSlug', element: <Learn /> },
          { path: '/lessons/:lessonId', element: <Lesson /> },
          // Account required before purchase, so these share the gated content's guard.
          { path: '/buy/:slug', element: <ProductBuy /> },
          { path: '/checkout/success', element: <CheckoutSuccess /> },
          { path: '/checkout/cancel', element: <CheckoutCancel /> },
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
        element: <AdminLayout />,
        children: [
          { path: '/admin', element: <AdminQuestions /> },
          { path: '/admin/questions', element: <AdminQuestions /> },
          { path: '/admin/courses', element: <AdminCourses /> },
          // Full-screen "Write" editor (week4_plan.md Phase 8, 8E-continued,
          // `[OWNER INSTRUCTION 2026-08-21]`) — its own route rather than a modal, so
          // it has Back/Cancel/Save and is reachable/refreshable by URL. Still nested
          // under AdminLayout (keeps the admin nav bar and the is_admin guard, same as
          // every other /admin/* route) — "full screen" means its own routed page, not
          // escaping the admin shell entirely.
          { path: '/admin/courses/:courseId/lessons/:lessonId/write', element: <LessonBodyWriteScreen /> },
          { path: '/admin/courses/:courseId/blocks/:blockId/write', element: <BlockTextWriteScreen /> },
          { path: '/admin/templates', element: <AdminTemplates /> },
          { path: '/admin/packs', element: <AdminPacks /> },
          { path: '/admin/media', element: <AdminMedia /> },
          { path: '/admin/contact', element: <AdminContact /> },
          { path: '/admin/orders', element: <AdminOrders /> },
          { path: '/admin/metrics', element: <AdminMetrics /> },
          { path: '/admin/users', element: <AdminUsers /> },
          { path: '/admin/audit', element: <AdminAudit /> },
          { path: '/admin/leads', element: <AdminLeads /> },
          { path: '/admin/settings', element: <AdminSettings /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
