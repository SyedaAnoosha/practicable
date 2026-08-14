import type { ReactNode } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { DraftBanner } from './DraftBanner'

// `[WIDENED 2026-08-14, owner feedback]` §19.1's 68ch reading measure read as a tiny
// island in a huge dark void at desktop widths, with nothing else on the page to fill
// the frame — the owner's own words were "too centered rather than the whole screen".
// Two changes together, both requested: the container widens from 68ch to a
// noticeably wider measure (max-w-3xl — still a reading document, not a marketing
// page, so short of /store's max-w-7xl), and `.page-wash` gives it the same
// background atmosphere every other index/content page already carries instead of
// sitting on flat, undecorated `--background`.
export function LegalLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="relative isolate mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      <div aria-hidden="true" className="page-wash absolute left-1/2 top-0 -z-10 h-[26rem] w-screen -translate-x-1/2" />
      <article>
        <PageTitle eyebrow="Legal" title={title} description={description} />
        <div className="mt-6">
          <DraftBanner />
        </div>
        <div className="mt-10 flex flex-col gap-8 font-serif text-read text-pretty text-foreground">{children}</div>
      </article>
    </div>
  )
}

// One section = one h2 (sans, per §13.5 — legal pages pair a sans heading with a
// serif body) plus its paragraphs. `space-y-4` approximates §14's editorial
// vertical rhythm (~1em between paragraphs at the 18px reading size) since
// `.prose-guidance` — the rhythm class §14 describes — was never actually built in
// theme.css; this is the same spacing by hand rather than a missing utility.
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-sans text-h3 font-semibold text-foreground">{heading}</h2>
      {children}
    </section>
  )
}
