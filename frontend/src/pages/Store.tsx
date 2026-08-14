import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Library } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { PageTitle } from '@/components/ui/PageTitle'
import { Button } from '@/components/ui/Button'
import { ContentTypeCard } from '@/components/store/ContentTypeCard'
import { riseItemSm, inViewOnce } from '@/lib/motion'

interface RelatedProduct {
  slug: string
  name: string
  price_amount: number
  currency: string
}

interface CourseSummary {
  slug: string
  title: string
  subtitle: string | null
  module_count: number
  lesson_count: number
  owned: boolean
  product: RelatedProduct | null
}

interface TemplateSummary {
  id: string
  slug: string
  title: string
  description: string
  file_name: string
  owned: boolean
  product: RelatedProduct | null
  is_free: boolean
}

// week2_plan.md Phase 4 / §20.1. Order is fixed — Reference packs · Courses ·
// Templates, the Product Spec's own order — and the three types are never merged
// into one grid: a store that renders them identically teaches the visitor they're
// the same thing (§36 — sections are not cards; the products inside them are).
function StoreSection({ title, explainer, children }: { title: string; explainer: string; children: ReactNode }) {
  return (
    <motion.section
      variants={riseItemSm}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className="border-t border-border pt-6"
    >
      <h2 className="text-h2 font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">{explainer}</p>
      <div className="mt-6">{children}</div>
    </motion.section>
  )
}

// Honest empty section (§20.1 / §49.1): if a type has nothing purchasable, say so
// plainly and link to the free thing. Never a "coming soon" tile styled like a product.
function EmptySection({ message, sub, linkTo, linkLabel }: { message: string; sub: string; linkTo: string; linkLabel: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
      <div>
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      </div>
      <Link to={linkTo}>
        <Button variant="outline" size="sm">
          {linkLabel}
        </Button>
      </Link>
    </div>
  )
}

export function Store() {
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: queryKeys.courses.list(),
    queryFn: () => api.get<CourseSummary[]>('/courses').then((res) => res.data),
  })
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => api.get<TemplateSummary[]>('/templates').then((res) => res.data),
  })

  return (
    <div className="relative isolate mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
      {/* §16.2: /store uses .page-wash, not .hero-wash — an index felt rather than
          noticed, not a landing page. */}
      <div aria-hidden="true" className="page-wash absolute left-1/2 top-0 -z-10 h-[30rem] w-screen -translate-x-1/2" />

      <PageTitle
        eyebrow="Store"
        title="Everything, in the shape you need it"
        description="Look something up, learn a domain properly, or take the one file you need today."
      />

      <div className="mt-12 flex flex-col gap-16 sm:gap-16">
        {/* ── Reference packs ─────────────────────────────────────────────────
            No domain-pack SKU exists yet (week2_plan.md W2-R6 — blocked on
            owner decision #19, the artefact). The mechanism (product +
            question_set contents + a template row) is ready to seed the moment
            a real PDF exists; until then this is the honest empty state, not a
            "coming soon" tile that looks like a product. */}
        <StoreSection
          title="Reference packs"
          explainer="Look something up. All 100 questions are free to read; a pack is the formatted artefact and the working order."
        >
          <EmptySection
            message="No packs are on sale yet."
            sub="The 100 questions are free to read in the meantime."
            linkTo="/questions"
            linkLabel="Browse the questions"
          />
        </StoreSection>

        {/* ── Courses ──────────────────────────────────────────────────────── */}
        <StoreSection
          title="Courses"
          explainer="Learn a domain properly — modules, lessons, and a progress bar that remembers where you stopped."
        >
          {coursesLoading && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-muted/40" />
              ))}
            </div>
          )}
          {!coursesLoading && (!courses || courses.length === 0) && (
            <EmptySection
              message="No courses are on sale yet."
              sub="Check back soon — the first course is on its way."
              linkTo="/courses"
              linkLabel="See the course catalogue"
            />
          )}
          {!coursesLoading && courses && courses.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <ContentTypeCard
                  key={course.slug}
                  variant="course"
                  href={`/courses/${course.slug}`}
                  title={course.title}
                  subLine={`${course.module_count} ${course.module_count === 1 ? 'module' : 'modules'} · ${course.lesson_count} ${course.lesson_count === 1 ? 'lesson' : 'lessons'}`}
                  price={course.product ? formatCurrency(course.product.price_amount, course.product.currency) : 'Not yet for sale'}
                  priceIsPlaceholder={!course.product}
                  actionLabel={course.owned ? 'Continue' : 'See what’s included'}
                  ownedBadge={course.owned ? 'In your library' : undefined}
                />
              ))}
            </div>
          )}
        </StoreSection>

        {/* ── Templates ────────────────────────────────────────────────────── */}
        <StoreSection
          title="Templates"
          explainer="One thing you need right now. Preview it, buy it, use it this week."
        >
          {templatesLoading && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-muted/40" />
              ))}
            </div>
          )}
          {!templatesLoading && (!templates || templates.length === 0) && (
            <EmptySection
              message="No templates are on sale yet."
              sub="Check back soon — the first template is on its way."
              linkTo="/templates"
              linkLabel="See the template catalogue"
            />
          )}
          {!templatesLoading && templates && templates.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => {
                const actionLabel = template.is_free
                  ? 'Get it free'
                  : template.owned
                    ? 'Download again'
                    : template.product
                      ? 'See what’s included'
                      : 'Not yet available'
                const priceLabel = template.is_free
                  ? 'Free'
                  : template.product
                    ? formatCurrency(template.product.price_amount, template.product.currency)
                    : 'Not yet for sale'
                return (
                  <ContentTypeCard
                    key={template.id}
                    variant="template"
                    href={`/templates/${template.id}`}
                    title={template.title}
                    subLine={template.description}
                    price={priceLabel}
                    priceIsPlaceholder={!template.is_free && !template.product}
                    actionLabel={actionLabel}
                    ownedBadge={!template.is_free && template.owned ? 'In your library' : undefined}
                  />
                )
              })}
            </div>
          )}
        </StoreSection>
      </div>

      {/* §20.1 / W2-R5: free entry points live inside the store, not below it — the
          100 free questions already surface inside Reference packs' empty state
          above and the free template inside Templates; this closing note exists so
          a visitor who skimmed past both still sees the free path stated once,
          plainly, at the point they'd otherwise leave. */}
      <div className="mt-16 flex items-center gap-4 rounded-lg border border-border bg-muted/30 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent/12 text-accent" aria-hidden="true">
          <Library className="size-[18px]" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Not ready to buy anything yet?</p>
          <p className="text-sm text-muted-foreground">All 100 questions are free to read, no account needed.</p>
        </div>
        <Link to="/questions">
          <Button variant="outline" size="sm">
            Browse the questions
          </Button>
        </Link>
      </div>
    </div>
  )
}
