import { Outlet } from 'react-router'

export default function AuthLayout() {
  return (
    <div id="main" className="flex min-h-screen items-center justify-center bg-background p-4">
      <Outlet />
    </div>
  )
}
