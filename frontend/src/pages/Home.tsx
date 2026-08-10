import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

// Week 1 scope guardrail: one reachable question page, not the discovery/filter UI
// (deferred to Week 2 — week1_plan.md Scope guardrails, reconciled against DESIGN.md
// §60). This links straight to it.
const WEEK1_QUESTION_SLUG = 'we-have-a-risk-register-but-no-one-uses-it'

export function Home() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <h1 className="font-sans font-semibold tracking-tight" style={{ fontSize: 'var(--text-display)' }}>
          Practical answers for risk practitioners
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          100 real questions tagged seven ways, with guidance you can act on today.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <CardDescription>Real guidance for a real risk-management problem.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to={`/questions/${WEEK1_QUESTION_SLUG}`}>
              <Button className="w-full">Read the question</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Courses</CardTitle>
            <CardDescription>Structured learning paths for risk practitioners.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" disabled>
              Coming in Week 2
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>Downloadable tools and frameworks.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to={`/questions/${WEEK1_QUESTION_SLUG}`}>
              <Button className="w-full" variant="outline">
                Find one from a question
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
