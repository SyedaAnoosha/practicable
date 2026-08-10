import { createBrowserRouter, RouterProvider } from 'react-router'

import RootLayout from '@/routes/_layouts/RootLayout'
import MarketingLayout from '@/routes/_layouts/MarketingLayout'
import AuthLayout from '@/routes/_layouts/AuthLayout'
import MemberLayout from '@/routes/_layouts/MemberLayout'

import { Home } from '@/pages/Home'
import { Question } from '@/pages/Question'
import { SignIn } from '@/pages/SignIn'
import { SignUp } from '@/pages/SignUp'
import { Lesson } from '@/pages/Lesson'
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
          { path: '/questions/:slug', element: <Question /> },
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
          { path: '/dashboard', element: <Home /> }, // Week 1 placeholder — a real dashboard is Week 2
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
