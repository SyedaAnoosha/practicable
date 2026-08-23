/**
 * BookmarkButton (W5-R5).
 *
 * The one surface for the bookmarks feature. The endpoints, the table and the hooks
 * all shipped without anything rendering them, so a learner could not save an item at
 * all — the feature existed only in the API.
 *
 * Signed-out visitors get nothing rather than a control that 401s on click: an action
 * that appears available and then fails is worse than one that isn't offered.
 */
import { Bookmark as BookmarkIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useAuthStore } from '@/stores/useAuthStore'
import { useBookmarks, useAddBookmark, useRemoveBookmark } from '@/hooks/useBookmarks'

interface BookmarkButtonProps {
  contentType: 'course' | 'template' | 'pack'
  contentId: string
  /** What the item is called, for the accessible name. */
  title: string
  className?: string
}

export function BookmarkButton({
  contentType,
  contentId,
  title,
  className,
}: BookmarkButtonProps) {
  const user = useAuthStore((s) => s.user)
  const { data: bookmarks } = useBookmarks()
  const addBookmark = useAddBookmark()
  const removeBookmark = useRemoveBookmark()

  // Nothing to save to while signed out.
  if (!user) return null

  const existing = bookmarks?.find(
    (b) => b.content_type === contentType && b.content_id === contentId,
  )
  const saved = Boolean(existing)
  const pending = addBookmark.isPending || removeBookmark.isPending

  const toggle = () => {
    if (pending) return
    if (existing) {
      removeBookmark.mutate(existing.id)
    } else {
      addBookmark.mutate({ contentType, contentId })
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      /* `aria-pressed` rather than two different labels: this is one control with two
         states, and a toggle button is what a screen reader should be told it is. The
         name carries the item title so the control is unambiguous in a list of them. */
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved items` : `Save ${title}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-60',
        saved
          ? 'border-gold/40 bg-gold-soft text-gold-strong hover:bg-gold/20'
          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <BookmarkIcon
        className={cn('size-3.5', saved && 'fill-current')}
        aria-hidden="true"
      />
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}
