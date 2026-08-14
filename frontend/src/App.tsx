import { createBrowserRouter, RouterProvider } from 'react-router'

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
import { Terms } from '@/pages/legal/Terms'
import { Privacy } from '@/pages/legal/Privacy'
import { Refunds } from '@/pages/legal/Refunds'
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
import { AdminOrders } from '@/pages/admin/AdminOrders'

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
          // week2_plan.md Phase 5 / W2-R7 — draft legal pages, marketing chrome like
          // Contact above: reachable from the footer, no account needed to read them.
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
          // Public: the free lead-magnet template must be reachable with no account.
          // Paid templates here show a buy/sign-in prompt instead of a download.
          { path: '/templates/:templateId', element: <Template /> },
          // week2_plan.md Phase 4 / W2-R5 — the storefront: three labelled content
          // types in the Product Spec's own order. Individual catalogues above stay
          // reachable directly; /store is the index that introduces the shape of all
          // three at once.
          { path: '/store', element: <Store /> },
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
          { path: '/admin/templates', element: <AdminTemplates /> },
          { path: '/admin/orders', element: <AdminOrders /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
