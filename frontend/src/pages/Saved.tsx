/**
 * Saved items (W5-R5).
 *
 * Closes the second half of the bookmarks feature. `BookmarkButton` let a learner save
 * an item, but nothing let them see what they had saved — the list endpoint existed and
 * no route rendered it, so saving was a write-only gesture. A "save" that cannot be
 * revisited is not a feature, it is a button.
 *
 * Two decisions worth naming:
 *
 *  * **Unavailable items are shown, not hidden.** An item can be unpublished or deleted
 *    after it was saved. Filtering those out would make things disappear from the list
 *    with no explanation, which reads as data loss. They are listed as plain text with
 *    a note and a Remove control instead — visible, honest, and clearable.
 *  * **Grouped by type, newest first within each group.** The API already returns
 *    newest-first; grouping is presentation only, so the order a learner saved things
 *    in is still legible inside each section.
 */
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Bookmark as BookmarkIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageTitle } from '@/components/ui/PageTitle'
import { SkeletonState } from '@/components/ui/SkeletonState'
import {
  BOOKMARK_TYPE_LABELS,
  bookmarkHref,
  useBookmarks,
  useRemoveBookmark,
  type Bookmark,
} from '@/hooks/useBookmarks'

/** The order sections appear in. Fixed rather than derived from the data, so the page
 * does not reorder itself as a learner saves different kinds of thing. */
const TYPE_ORDER = ['course', 'template', 'pack'] as const

function SavedRow({ bookmark }: { bookmark: Bookmark }) {
  const removeBookmark = useRemoveBookmark()
  const href = bookmark.available === false ? null : bookmarkHref(bookmark)
  const title = bookmark.title ?? 'This item is no longer available'

  return (
    <li className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        {href ? (
          <Link
            to={href}
            className="block truncate font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {title}
          </Link>
        ) : (
          /* Not a link: the target would 404. Said plainly rather than left as a
             dead-looking row the learner would click anyway. */
          <>
            <p className="truncate font-medium text-muted-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">
              It may have been removed since you saved it.
            </p>
          </>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => removeBookmark.mutate(bookmark.id)}
        loading={removeBookmark.isPending}
        /* The item title is in the accessible name: in a list of Remove buttons,
           "Remove" alone tells a screen-reader user nothing about which one. */
        aria-label={`Remove ${bookmark.title ?? 'this item'} from saved items`}
      >
        Remove
      </Button>
    </li>
  )
}

export function Saved() {
  const { data: bookmarks, isLoading, isError } = useBookmarks()

  const grouped = useMemo(() => {
    const byType = new Map<string, Bookmark[]>()
    for (const bookmark of bookmarks ?? []) {
      const list = byType.get(bookmark.content_type)
      if (list) list.push(bookmark)
      else byType.set(bookmark.content_type, [bookmark])
    }
    // Known types in their fixed order, then anything unrecognised, so a content type
    // added later still appears rather than being silently dropped.
    const known = TYPE_ORDER.filter((t) => byType.has(t)) as string[]
    const rest = [...byType.keys()].filter((t) => !TYPE_ORDER.includes(t as never))
    return [...known, ...rest].map((type) => [type, byType.get(type)!] as const)
  }, [bookmarks])

  const total = bookmarks?.length ?? 0

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <PageTitle
          eyebrow="Your library"
          title="Saved items"
          description="Everything you've saved, newest first."
        />

        <div className="mt-8">
          {isLoading ? (
            <SkeletonState rows={4} variant="row" />
          ) : isError ? (
            <EmptyState
              icon={BookmarkIcon}
              title="We couldn't load your saved items"
              description="Refresh the page to try again."
            />
          ) : total === 0 ? (
            <EmptyState
              icon={BookmarkIcon}
              title="Nothing saved yet"
              description="Use the Save button on a course, template or pack and it will appear here."
              /* A plain Link styled as the secondary button: `Button` renders a real
                 <button> and has no `asChild`, and nesting an anchor inside a button
                 is invalid HTML that breaks keyboard activation. */
              action={
                <Link
                  to="/courses"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Browse courses
                </Link>
              }
            />
          ) : (
            <>
              {/* The count is announced, not just drawn: a learner using a screen
                  reader gets the same "how much is here" that sighted users get
                  from the page shape. */}
              <p className="sr-only" role="status">
                {total} saved {total === 1 ? 'item' : 'items'}
              </p>
              <div className="flex flex-col gap-8">
                {grouped.map(([type, items]) => (
                  <section key={type} aria-labelledby={`saved-${type}`}>
                    <h2
                      id={`saved-${type}`}
                      className="mb-1 font-sans text-sm font-semibold text-muted-foreground"
                    >
                      {BOOKMARK_TYPE_LABELS[type] ?? type}
                      <span className="ml-2 font-normal">({items.length})</span>
                    </h2>
                    <ul className="list-none">
                      {items.map((bookmark) => (
                        <SavedRow key={bookmark.id} bookmark={bookmark} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
