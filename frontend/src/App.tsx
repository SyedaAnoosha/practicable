import { createBrowserRouter, RouterProvider } from 'react-router'

import RootLayout from '@/routes/_layouts/RootLayout'
import MarketingLayout from '@/routes/_layouts/MarketingLayout'
import CatalogueLayout from '@/routes/_layouts/CatalogueLayout'
import AuthLayout from '@/routes/_layouts/AuthLayout'
import MemberLayout from '@/routes/_layouts/MemberLayout'
import AdminLayout from '@/routes/_layouts/AdminLayout'

import { Home } from '@/pages/Home'
import { Dashboard } from '@/pages/Dashboard'
import { Library } from '@/pages/Library'
import { Question } from '@/pages/Question'
import { QuestionsCatalogue } from '@/pages/QuestionsCatalogue'
import { CoursesCatalogue } from '@/pages/CoursesCatalogue'
import { CourseDetail } from '@/pages/CourseDetail'
import { TemplatesCatalogue } from '@/pages/TemplatesCatalogue'
import { SignIn } from '@/pages/SignIn'
import { SignUp } from '@/pages/SignUp'
import { Lesson } from '@/pages/Lesson'
import { Learn } from '@/pages/Learn'
import { Template } from '@/pages/Template'
import { ProductBuy } from '@/pages/ProductBuy'
import { CheckoutSuccess } from '@/pages/CheckoutSuccess'
import { CheckoutCancel } from '@/pages/CheckoutCancel'
import { AdminQuestions } from '@/pages/admin/AdminQuestions'
import { AdminTemplates } from '@/pages/admin/AdminTemplates'
import { AdminCourses } from '@/pages/admin/AdminCourses'

// react-router v8, data mode (DESIGN.md §51.6). Week 1 needs four layouts, not the
// Admin one (Week 3 — week1_plan.md Scope guardrails).
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <MarketingLayout />,
        // The landing page stays purely public chrome even for signed-in visitors:
        // it's the marketing front door, and a member already has /dashboard as
        // their home. Everything else moved to CatalogueLayout below.
        children: [{ path: '/', element: <Home /> }],
      },
      {
        // Public routes that a signed-in member also lives in, so they keep the
        // member sidebar instead of dropping the visitor back into marketing chrome
        // mid-session (CatalogueLayout.tsx documents the bug this fixes). Still
        // public — no auth guard, no account needed to browse or read.
        element: <CatalogueLayout />,
        children: [
          { path: '/questions', element: <QuestionsCatalogue /> },
          { path: '/questions/:slug', element: <Question /> },
          // Public product/syllabus pages (DESIGN.md §41: /courses, /courses/:slug),
          // distinct from /learn/:courseSlug/:lessonSlug below — browsing what a
          // course contains before buying needs no account, same as /questions/:slug.
          { path: '/courses', element: <CoursesCatalogue /> },
          { path: '/courses/:slug', element: <CourseDetail /> },
          { path: '/templates', element: <TemplatesCatalogue /> },
          // Public, not member-only: the free lead-magnet template has to be
          // reachable with no account at all (product spec §9). Paid templates at
          // this route show a buy/sign-in prompt instead of a download — the page
          // branches on the template, and the API is the real boundary either way.
          { path: '/templates/:templateId', element: <Template /> },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          { path: '/sign-in', element: <SignIn /> },
          { path: '/sign-up', element: <SignUp /> },
        ],
      },
      {
        element: <MemberLayout />,
        children: [
          { path: '/dashboard', element: <Dashboard /> },
          // Product spec §9: "'My Library' panel: purchased items across all types,
          // clearly labeled, with progress and resume where relevant."
          { path: '/library', element: <Library /> },
          // The full learning interface (DESIGN.md §24.1) — sidebar outline,
          // video/reading/download content, prev/next, mark complete. The bare
          // /lessons/:lessonId player stays for any lesson with no module/course
          // (products.py falls back to it when a lesson isn't part of one).
          { path: '/learn/:courseSlug/:lessonSlug', element: <Learn /> },
          { path: '/lessons/:lessonId', element: <Lesson /> },
          // Account-required before purchase (week1_plan.md decision #8) — these live
          // under the same auth-guarded layout as the gated content itself.
          { path: '/buy/:slug', element: <ProductBuy /> },
          { path: '/checkout/success', element: <CheckoutSuccess /> },
          { path: '/checkout/cancel', element: <CheckoutCancel /> },
        ],
      },
      {
        // The content editor (product spec §9). AdminLayout checks the role for a
        // clean message, but the real boundary is server-side: every /admin/* API
        // route is guarded by require_admin at the router level.
        element: <AdminLayout />,
        children: [
          { path: '/admin', element: <AdminQuestions /> },
          { path: '/admin/questions', element: <AdminQuestions /> },
          { path: '/admin/courses', element: <AdminCourses /> },
          { path: '/admin/templates', element: <AdminTemplates /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
