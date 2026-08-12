import { XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { SUPPORT_MAILTO } from '@/lib/support'

// DESIGN.md §29.3: never "Oops", never blame the user. State affirmatively that no
// money moved — that's the thing they're anxious about when checkout is abandoned
// or declined.

// get mail from env

export function CheckoutCancel() {
  return (
    <div className="mx-auto w-full max-w-xl px-5 py-12 sm:px-8">
      <Card>
        <CardHeader>
          {/* Same status-tile language as CheckoutSuccess — muted here, since nothing
              went wrong, checkout was simply abandoned (§29.3: no blame). */}
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-inset ring-border">
            <XCircle className="size-5" aria-hidden="true" />
          </span>
          <CardTitle className="mt-3">Payment wasn't completed.</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-foreground">Your card has not been charged.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="sm:flex-1" onClick={() => window.history.back()}>
              Try checkout again
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Still stuck?{' '}
            <a href={SUPPORT_MAILTO} className="underline">
              Contact us
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
