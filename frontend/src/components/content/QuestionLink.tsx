import { Link } from 'react-router'

/** The questions a routing panel routes through. The slug travels with the title
 *  because W4-R4's acceptance is specific — the titles appear "by title, as a link" —
 *  and a title alone could only ever render as inert text. */
export interface RoutedQuestion {
  slug: string
  title: string
}

/** week4_plan.md W4-R4 acceptance 2 — "Every recommendation states at least one real
 *  question it routes through, by title, as a link."
 *
 *  The link is what makes the explanation checkable rather than asserted: a reader who
 *  doubts the recommendation can open the question and see for themselves. Rendered
 *  inside a sentence, so it takes the in-prose link treatment (underline carried by the
 *  text, `--foreground` weight rather than a coloured link) instead of the standalone
 *  link style — the same distinction `LicenceLine` was corrected to on 2026-08-20 after
 *  axe flagged a link-in-text-block contrast failure.
 */
export const QuestionLink = ({ question }: { question: RoutedQuestion }) => (
  <Link
    to={`/questions/${question.slug}`}
    className="font-semibold text-foreground underline decoration-border underline-offset-2 transition-colors hover:decoration-gold-strong"
  >
    {question.title}
  </Link>
)
