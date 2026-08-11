import { createBrowserRouter, RouterProvider } from 'react-router'

import RootLayout from '@/routes/_layouts/RootLayout'
import MarketingLayout from '@/routes/_layouts/MarketingLayout'
import AuthLayout from '@/routes/_layouts/AuthLayout'
import MemberLayout from '@/routes/_layouts/MemberLayout'

import { Home } from '@/pages/Home'
import { Dashboard } from '@/pages/Dashboard'
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

// react-router v8, data mode (DESIGN.md §51.6). Week 1 needs four layouts, not the
// Admin one (Week 3 — week1_plan.md Scope guardrails).
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <MarketingLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/questions', element: <QuestionsCatalogue /> },
          { path: '/questions/:slug', element: <Question /> },
          // Public product/syllabus pages (DESIGN.md §41: /courses, /courses/:slug),
          // distinct from /learn/:courseSlug/:lessonSlug below — browsing what a
          // course contains before buying needs no account, same as /questions/:slug.
          { path: '/courses', element: <CoursesCatalogue /> },
          { path: '/courses/:slug', element: <CourseDetail /> },
          { path: '/templates', element: <TemplatesCatalogue /> },
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
          // The full learning interface (DESIGN.md §24.1) — sidebar outline,
          // video/reading/download content, prev/next, mark complete. The bare
          // /lessons/:lessonId player stays for any lesson with no module/course
          // (products.py falls back to it when a lesson isn't part of one).
          { path: '/learn/:courseSlug/:lessonSlug', element: <Learn /> },
          { path: '/lessons/:lessonId', element: <Lesson /> },
          { path: '/templates/:templateId', element: <Template /> },
          // Account-required before purchase (week1_plan.md decision #8) — these live
          // under the same auth-guarded layout as the gated content itself.
          { path: '/buy/:slug', element: <ProductBuy /> },
          { path: '/checkout/success', element: <CheckoutSuccess /> },
          { path: '/checkout/cancel', element: <CheckoutCancel /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
