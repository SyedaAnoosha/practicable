import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { StatusDot } from '@/components/ui/StatusDot'
import { cn } from '@/lib/utils/cn'
import { staggerContainer, riseItem, riseItemSm, inViewOnce } from '@/lib/motion'

/**
 * The about page: what Practicable is, who it is for, and what it does differently.
 *
 * 
 */
export function About() {
  return (
    <div className="w-full">
      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="w-full py-14 sm:py-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mx-auto flex max-w-2xl flex-col items-center px-5 text-center sm:px-8"
        >
          <StatusDot label="About Practicable" />
          <motion.h1 variants={riseItem} className="mt-5 text-h1 font-semibold text-foreground">
            Real guidance for risk practitioners
          </motion.h1>
          <motion.p variants={riseItem} className="mt-4 max-w-xl font-serif text-lead text-muted-foreground">
            A small, focused library of courses, templates, and reference packs built by people
            who have done the work — not a content farm, not a compliance checkbox.
          </motion.p>
          {/* Facts, not adjectives. Everything here is verifiable elsewhere on the page
              or in the product, so the line reads as a specification rather than a claim. */}
          <motion.p
            variants={riseItemSm}
            className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground/70"
          >
            100 questions across five domains · One-time purchase, lifetime access
          </motion.p>
        </motion.div>
      </section>

      {/* ── What we believe ────────────────────────────────────────────────────
          Numbered hairline rows rather than three identical cards: the numbering
          carries the order the beliefs were written in, and the missing boxes let
          the band plane do the grouping. */}
      {/* `band-dotgrid` gives the plane a faint 3%-ink texture so the first plane
          change registers as material, not just a grey rectangle (theme.css §M2). */}
      <section className="band band-dotgrid w-full py-12 sm:py-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="mx-auto max-w-5xl px-5 sm:px-8"
        >
          <motion.h2 variants={riseItem} className="text-h2 font-semibold text-foreground">
            What we believe
          </motion.h2>
          {/* Plain rows rather than a <dl>: a definition list wants dt before dd, and
              the leading row number would have forced a dd above its dt. h3/p keep the
              document outline honest instead. */}
          <div className="mt-8">
            {BELIEFS.map((b, i) => (
              <motion.div
                key={b.title}
                variants={riseItem}
                className="grid gap-2 border-t border-border py-6 last:border-b sm:grid-cols-[3.5rem_minmax(0,14rem)_1fr] sm:gap-6 sm:py-7"
              >
                <span
                  className="text-sm font-medium tabular-nums text-muted-foreground/70"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-base font-semibold text-foreground">{b.title}</h3>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{b.body}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Who / How ──────────────────────────────────────────────────────────
          Eyebrow-column sections: the heading sits left with an annotation, the
          content right. Two adjacent sections get deliberately different list
          treatments (plain bullets vs. ruled steps) so they don't read as twins. */}
      <section className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="grid gap-x-10 gap-y-4 md:grid-cols-[minmax(0,15rem)_1fr]"
        >
          <motion.div variants={riseItem}>
            <h2 className="text-h3 font-semibold text-foreground">Who it is for</h2>
            <p className="mt-2 hidden text-sm leading-relaxed text-muted-foreground/80 md:block">
              If one of these sounds like your week, the material was written for you.
            </p>
          </motion.div>
          <motion.ul variants={riseItem} className="space-y-3">
            {AUDIENCES.map((a) => (
              <li key={a} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                <span className="mt-[0.45em] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {a}
              </li>
            ))}
          </motion.ul>

          <motion.div variants={riseItem} className="mt-6 border-t border-border pt-8 md:mt-10 md:border-t-0 md:pt-0">
            <h2 className="text-h3 font-semibold text-foreground">How it works</h2>
            <p className="mt-2 hidden text-sm leading-relaxed text-muted-foreground/80 md:block">
              Three steps. No trial, no seat licence, nothing to cancel.
            </p>
          </motion.div>
          <motion.ol variants={riseItem} className="mt-6 space-y-0 md:mt-0">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={cn(
                  'flex gap-4 pb-6',
                  i < STEPS.length - 1 && 'border-b border-border',
                )}
              >
                <span className="pt-0.5 text-sm font-medium tabular-nums text-primary">
                  {i + 1}
                </span>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{s}</p>
              </li>
            ))}
          </motion.ol>
        </motion.div>
      </section>

      {/* ── The free floor ─────────────────────────────────────────────────────
          The strongest fact this product has — the questions cost nothing — gets
          its own plane instead of a bullet. Serif, because it's the page speaking
          plainly rather than listing. */}
      <section className="band-cool w-full py-12 sm:py-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="mx-auto max-w-2xl px-5 text-center sm:px-8"
        >
          <motion.p variants={riseItem} className="font-serif text-h3 text-foreground">
            The hundred questions are free. All of them, with the guidance underneath —
            no account, no email wall.
          </motion.p>
          <motion.p variants={riseItemSm} className="mt-4 text-sm text-muted-foreground">
            Read them first. Buy something only if the thinking holds up.
          </motion.p>
          <motion.div variants={riseItemSm} className="mt-6">
            <Link to="/questions">
              <Button variant="outline" size="lg">
                Start reading
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FAQs ─────────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
        >
          <motion.h2 variants={riseItem} className="text-h2 font-semibold text-foreground">
            Frequently asked questions
          </motion.h2>
          <motion.div variants={riseItem} className="mt-6 border-t border-border">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="border-t border-border w-full py-12 sm:py-16">
        <motion.div
          variants={riseItemSm}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 text-center sm:flex-row sm:justify-center sm:gap-4 sm:px-8"
        >
          <Link to="/store" className="w-full sm:w-auto">
            <Button size="lg" className="w-full gap-2 sm:w-auto">
              Browse the library
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground">One-time purchase. Lifetime access.</span>
        </motion.div>
      </section>
    </div>
  )
}

// ── Data ────────────────────────────────────────────────────────────────────

const BELIEFS = [
  {
    title: 'Built from practice',
    body: 'Every course, template, and pack comes from real risk work — not rehashed textbook summaries.',
  },
  {
    title: 'One-time purchase',
    body: 'Buy once, use forever. No subscriptions, no expiring licences, no surprises.',
  },
  {
    title: 'For practitioners',
    body: 'Written for the person doing the work, not the person buying the software. Practical, not theoretical.',
  },
] as const

const AUDIENCES = [
  'Risk managers building or maturing a framework',
  'Compliance leads who need practical templates, not theory',
  'Cybersecurity professionals who want structured, reusable tools',
  'Anyone responsible for organisational resilience and governance',
] as const

const STEPS = [
  'Browse the courses, templates, or reference packs and find what fits your situation.',
  'Buy once with a single payment — you get lifetime access immediately.',
  'Download, learn, and apply. Every resource is designed to be used today, not filed away.',
] as const

const FAQS = [
  {
    q: 'What do I get when I buy a course?',
    a: 'Lifetime access to every lesson in the course — video, reading, and downloadable templates. You can revisit the material at any time, and new lessons added after your purchase unlock automatically.',
  },
  {
    q: 'Is there a subscription or recurring fee?',
    a: 'No. Every purchase is a one-time payment. No subscriptions, no expiring licences, no hidden charges.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Yes. If the content is not what you expected, you can request a refund from your purchases page. Refunded access is revoked immediately and the order is recorded for audit.',
  },
  {
    q: 'Are the templates editable?',
    a: 'Yes. Templates are delivered as editable files (XLSX, DOCX, or PDF depending on the product). You can modify them for your own organisation straight away.',
  },
  {
    q: 'How are the courses structured?',
    a: 'Each course is divided into modules, and each module into lessons. Lessons are video, reading, or downloadable artifacts. Your progress is tracked so you can pick up where you left off.',
  },
  {
    q: 'Do I need an account to browse?',
    a: 'No. All 100 questions and their answers are free to read without an account. You only need to sign in when you buy something or want to track your progress.',
  },
  {
    q: 'Can I buy for a team?',
    a: 'Not yet — the current model is individual purchases. If you are buying for a team, get in touch via the contact page and we can discuss options.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'All major credit and debit cards, processed through Stripe. The payment page is hosted by Stripe — your card details never touch our servers.',
  },
] as const

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 py-4 text-left transition-colors duration-150 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
            {question}
          </span>
        </button>
      </h3>
      {open && (
        <div className="pb-4 pl-7 pr-2 text-sm leading-relaxed text-muted-foreground">
          {answer}
        </div>
      )}
    </div>
  )
}
