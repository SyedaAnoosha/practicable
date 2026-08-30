import { Link, Outlet } from 'react-router'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { StatusDot } from '@/components/ui/StatusDot'
import { authStagger, springItem } from '@/lib/motion'

/** Split-screen auth shell: a full-height brand panel left (mark top, headline bottom),
 * a centred form column right, stacked on mobile. The left panel is the `--stage` plane
 * under a layered gradient rather than a hosted photo — no external image request in
 * the auth path, and every stop is a token so it follows a theme swap.
 */
export default function AuthLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      {/* ── Left: brand panel ──
          A real <header> landmark, not a bare div: axe's landmark-one-main/region rules
          flag the wordmark, back link and headline as page content contained by no
          landmark at all otherwise. */}
      <header className="relative isolate flex min-h-[38vh] w-full flex-col justify-between overflow-hidden bg-stage p-8 text-stage-foreground sm:p-10 lg:min-h-screen lg:w-1/2">
        {/* Auth-08 fills this panel with a hosted photograph. `.stage-aurora`
            (theme.css) replaces it with the same composition drawn in blue — no image
            request anywhere in the auth path, and it follows a theme swap because every
            stop is a token. This is the surface the aurora was tuned against: the
            headline sits bottom-left, which the class keeps dark by construction while
            the light climbs into the empty opposite corner. */}
        <div aria-hidden="true" className="stage-aurora -z-10" />

        {/* Auth-08's header row: mark on one side, a way back on the other. */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="font-serif text-2xl tracking-tight text-stage-foreground sm:text-3xl">
            Practicable
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-stage-foreground/70 transition-colors hover:text-stage-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Link>
        </div>

        {/* Auth-08 pins the promise to the bottom of the panel. */}
        <motion.div
          variants={authStagger}
          initial="hidden"
          animate="visible"
          className="relative z-10 mt-6 max-w-lg"
        >
          <motion.div variants={springItem}>
            <StatusDot label="Free to browse — no card, no trial" tone="gold" on="stage" />
          </motion.div>
          <motion.h2
            variants={springItem}
            className="mt-6 text-3xl font-medium leading-[1.12] tracking-[-0.03em] sm:text-4xl xl:text-5xl"
          >
            100 real questions from risk leaders.
          </motion.h2>
          <motion.p variants={springItem} className="mt-4 font-serif text-lead text-stage-foreground/75">
            Tagged by effort, cost, duration and regulatory pressure — so you can find what to fix
            first, not just what to read next.
          </motion.p>
        </motion.div>
      </header>

      {/* ── Right: form column ── */}
      <main id="main" className="relative flex w-full flex-col items-center justify-center bg-background p-6 sm:p-12 lg:w-1/2">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
        <motion.div
          variants={authStagger}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
