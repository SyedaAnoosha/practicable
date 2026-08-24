/**
 * ReviewForm (W5-R4 Stage A — submission half).
 *
 * `POST /reviews` shipped with full entitlement gating, but nothing ever called it:
 * a buyer had no way to leave a review from any product page, so the only reviews
 * that could exist were ones inserted outside the UI. This closes that gap.
 *
 * The backend is the authority on who may review — it re-checks entitlement and
 * returns 403 `not_entitled` regardless of what the client renders. The `owned`
 * check at the call sites is presentation only: there is no point showing a form to
 * someone whose submission will certainly be refused.
 *
 * A submitted review lands in `pending` and is invisible to the public until an
 * admin approves it in /admin/reviews. The success copy says so, because a reviewer
 * who does not see their words appear will otherwise submit again.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Star } from 'lucide-react'
import axios from 'axios'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Input'
import { FieldError } from '@/components/ui/FieldError'
import { cn } from '@/lib/utils/cn'

interface ReviewFormProps {
  contentType: 'course' | 'template' | 'pack'
  contentId: string
  /** Names the thing being reviewed in the heading, so the control is unambiguous
   *  on a page that has several other actions on it. */
  contentTitle: string
  className?: string
}

const MAX_BODY = 2000

export function ReviewForm({
  contentType,
  contentId,
  contentTitle,
  className,
}: ReviewFormProps) {
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [body, setBody] = useState('')
  const [showRatingError, setShowRatingError] = useState(false)

  const submit = useMutation({
    mutationFn: () =>
      api
        .post('/reviews', {
          content_type: contentType,
          content_id: contentId,
          rating,
          body: body.trim() || null,
        })
        .then((r) => r.data),
    onSuccess: () => {
      // The new review is pending, so it cannot appear in the featured list yet —
      // but invalidating keeps this page honest if an admin approves it while the
      // reader is still here.
      queryClient.invalidateQueries({
        queryKey: ['reviews', 'featured', contentType, contentId],
      })
    },
  })

  /** 409 is a duplicate, not a failure of the form — the reader already reviewed
   *  this item. Saying "something went wrong" there would be a lie, and would invite
   *  a retry that can never succeed. */
  const status = axios.isAxiosError(submit.error) ? submit.error.response?.status : undefined
  const alreadyReviewed = status === 409

  if (submit.isSuccess) {
    return (
      <div
        role="status"
        className={cn(
          'flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center',
          className,
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-success/12">
          <Check className="size-6 text-success" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-h4 font-semibold text-foreground">Thanks for the review</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          It&apos;s with us now. Reviews are read before they go up, so it won&apos;t appear
          on the page straight away.
        </p>
      </div>
    )
  }

  if (alreadyReviewed) {
    return (
      <div
        role="status"
        className={cn('rounded-xl border border-border bg-card p-6', className)}
      >
        <h3 className="text-h4 font-semibold text-foreground">You&apos;ve already reviewed this</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          One review per person. Get in touch if you&apos;d like to change what you said.
        </p>
      </div>
    )
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) {
      setShowRatingError(true)
      return
    }
    setShowRatingError(false)
    submit.mutate()
  }

  // `hovered || rating` so the row previews the value the pointer is about to pick.
  const shown = hovered || rating

  return (
    <form
      onSubmit={onSubmit}
      className={cn('rounded-xl border border-border bg-card p-6', className)}
    >
      <h3 className="text-h4 font-semibold text-foreground">Leave a review</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        You bought {contentTitle}. How did it go?
      </p>

      <fieldset className="mt-5">
        {/* A legend rather than a <Label>: the control is the group of five buttons,
            not any single one, and a label pointing at one star would be wrong. */}
        <legend className="text-sm font-medium text-foreground">Your rating</legend>
        <div
          className="mt-2 flex items-center gap-1"
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setRating(n)
                setShowRatingError(false)
              }}
              onMouseEnter={() => setHovered(n)}
              /* `aria-pressed` marks which value is chosen. The accessible name is the
                 whole phrase, not the bare number, so it is meaningful read alone. */
              aria-pressed={rating === n}
              aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
              className="rounded p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Star
                className={cn(
                  'size-7 transition-colors',
                  n <= shown ? 'fill-warning text-warning' : 'text-muted-foreground',
                )}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        {showRatingError && <FieldError message="Pick a rating from one to five stars." />}
      </fieldset>

      <div className="mt-5 grid gap-1.5">
        <Label htmlFor="review-body">What stood out? (optional)</Label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
          rows={4}
          maxLength={MAX_BODY}
          placeholder="What you used it for, and whether it did the job."
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        {/* Only once it is close enough to matter — a counter from zero is noise. */}
        {body.length > MAX_BODY - 200 && (
          <p className="text-xs text-muted-foreground">
            {MAX_BODY - body.length} characters left
          </p>
        )}
      </div>

      {submit.isError && !alreadyReviewed && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {status === 403
            ? 'This review needs a purchase of this item on your account.'
            : 'That didn’t send. Try again in a moment.'}
        </p>
      )}

      <div className="mt-5">
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? 'Sending…' : 'Submit review'}
        </Button>
      </div>
    </form>
  )
}
