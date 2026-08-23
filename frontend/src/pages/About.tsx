import { motion } from 'motion/react'
import { ArrowRight, BookOpen, Shield, Users } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { StatusDot } from '@/components/ui/StatusDot'
import { cn } from '@/lib/utils/cn'
import { staggerContainer, riseItem, riseItemSm } from '@/lib/motion'

/**
 * The about page: what Practicable is, who it is for, and what it does differently.
 *
 * Visual pattern follows Contact.tsx: a centred StatusDot pill, a large heading,
 * staggered motion sections, and blurred polygon blobs behind the hero. The page is
 * informational only — no forms, no mutations.
 */
export function About() {
  return (
    <section className="relative isolate w-full overflow-hidden py-9 sm:py-28">
      <Blob position="left-[max(-9rem,calc(50%-52rem))]" gradient="from-accent to-accent/50" />
      <Blob position="left-[max(45rem,calc(50%+8rem))]" gradient="from-gold to-gold/40" />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="mx-auto w-full max-w-7xl px-5 sm:px-8"
      >
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <motion.div variants={riseItem} className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <StatusDot label="About Practicable" />
          <h1 className="mt-5 text-h1 font-semibold text-foreground">
            Real guidance for risk practitioners
          </h1>
          <p className="mt-4 max-w-xl text-lead text-muted-foreground">
            Practicable is a small, focused library of courses, templates, and reference packs
            built by people who have done the work — not a content farm, not a compliance checkbox.
          </p>
        </motion.div>

        {/* ── What we believe ──────────────────────────────────────────────── */}
        <motion.div variants={riseItem} className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-h2 font-semibold text-foreground">What we believe</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {BELIEFS.map((b) => (
              <div
                key={b.title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-lg',
                    b.iconBg,
                  )}
                >
                  <b.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Who it is for ────────────────────────────────────────────────── */}
        <motion.div variants={riseItem} className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-h2 font-semibold text-foreground">Who it is for</h2>
          <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li className="flex gap-3">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              Risk managers building or maturing a framework
            </li>
            <li className="flex gap-3">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              Compliance leads who need practical templates, not theory
            </li>
            <li className="flex gap-3">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              Cybersecurity professionals who want structured, reusable tools
            </li>
            <li className="flex gap-3">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              Anyone responsible for organisational resilience and governance
            </li>
          </ul>
        </motion.div>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <motion.div variants={riseItem} className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-h2 font-semibold text-foreground">How it works</h2>
          <ol className="mt-6 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-4">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground pt-1">{s}</p>
              </li>
            ))}
          </ol>
        </motion.div>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <motion.div variants={riseItemSm} className="mx-auto mt-16 flex max-w-3xl justify-center">
          <Link to="/store">
            <Button size="lg" className="gap-2">
              Browse the library
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}

// ── Data ────────────────────────────────────────────────────────────────────

const BELIEFS = [
  {
    icon: BookOpen,
    iconBg: 'bg-primary/10',
    title: 'Built from practice',
    body: 'Every course, template, and pack comes from real risk work — not rehashed textbook summaries.',
  },
  {
    icon: Shield,
    iconBg: 'bg-gold/10',
    title: 'One-time purchase',
    body: 'Buy once, use forever. No subscriptions, no expiring licences, no surprises.',
  },
  {
    icon: Users,
    iconBg: 'bg-accent/10',
    title: 'For practitioners',
    body: 'Written for the person doing the work, not the person buying the software. Practical, not theoretical.',
  },
] as const

const STEPS = [
  'Browse the courses, templates, or reference packs and find what fits your situation.',
  'Buy once with a single payment — you get lifetime access immediately.',
  'Download, learn, and apply. Every resource is designed to be used today, not filed away.',
] as const

/** A blurred polygon with a torn-paper silhouette, matching Contact.tsx. */
function Blob({ position, gradient }: { position: string; gradient: string }) {
  return (
    <div aria-hidden="true" className={cn('absolute top-1/2 -z-10 -translate-y-1/2 transform-gpu blur-2xl', position)}>
      <div
        style={{
          clipPath:
            'polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)',
        }}
        className={cn('aspect-[577/310] w-[36rem] bg-gradient-to-r opacity-[0.12]', gradient)}
      />
    </div>
  )
}
