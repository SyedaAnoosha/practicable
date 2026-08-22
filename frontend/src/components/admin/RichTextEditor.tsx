/**
 * RichTextEditor — Tiptap-based editor for lesson prose and block text.
 *
 * week4_plan.md Phase 8 (8E-4): Heading levels are capped at h2-h4.
 * A lesson body's <h1> would compete with the page's own PageTitle <h1>,
 * which §22 forbids and axe will flag.  The toolbar still presents three
 * heading levels labelled "Heading 1/2/3" — matching how an author thinks
 * about a document's own outline — but they emit <h2>/<h3>/<h4> under the
 * hood, so the page never ends up with two real <h1>s. Three visible levels
 * — h2/h3/h4 — styled at the §13.1 rungs the design already defines.
 *
 * week4_plan.md Phase 8 (8E-8): Link and Underline extensions installed
 * per W4-R13.
 */
import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  List, ListOrdered, Quote,
  Heading2, Heading3, Heading4,
  Table as TableIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  className?: string
}

export function RichTextEditor({ content, onChange, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Heading is already in StarterKit; we keep the default heading extension
        // but only allow h2-h4 via the toolbar below.
        // Found 2026-08-21: Tiptap v3's StarterKit bundles `link` and `underline` by
        // default (a change from v2, which this file's own extension list was
        // apparently written against) — both were being registered twice, once by
        // StarterKit and once by this file's own separate imports below, which need
        // custom config (forced rel/target on Link) StarterKit's defaults don't carry.
        // Logged as "[tiptap warn]: Duplicate extension names found" and, worse,
        // caused literal `<p>`/`<br>` tags to render as visible text in the editor
        // instead of being parsed as markup (reported live via screenshot) — the
        // duplicate registration corrupted the schema Tiptap builds `content` against.
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        // `.rich-text` is the real styling and is the SAME class the reading page uses
        // (theme.css §8E-6), so what the author sees here is what the reader gets.
        //
        // `prose prose-sm` used to sit here too and were removed 2026-08-22: they come
        // from @tailwindcss/typography, which this project deliberately does not use
        // (its defaults would introduce a second type scale beside §13.1's) and which
        // is not installed. They were dead classes that read as if the editor pane
        // rendered at a smaller size than the reading page — it never did.
        class: 'rich-text max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  })

  /* `[ADDED 2026-08-22]` Tiptap reads `content` ONCE, when the editor instance is
   * created. Any later value is ignored — so whenever the prop arrives or changes
   * after mount (a query resolving, switching between two lessons without unmounting
   * the shell, an autosave round-trip returning canonicalised markup), the editor kept
   * showing whatever it was built with. The visible symptom was a body that appeared
   * as literal `<p>`/`<h3>` text: the editor had been created against an empty or
   * plain-text value and the real HTML never reached the schema parser.
   *
   * The `getHTML()` comparison is what keeps this from fighting the author: on every
   * keystroke `onUpdate` lifts the HTML into the parent, which sends it straight back
   * down as `content`. Without the guard that round-trip would call `setContent` on
   * each character, destroying and rebuilding the document and throwing the cursor to
   * the end of it. Re-setting only when the incoming value genuinely differs from what
   * is on screen means typing never triggers it.
   *
   * `emitUpdate: false` — this is the parent's own value coming back, not an edit, and
   * echoing it would mark a clean document dirty and wake the autosave. */
  useEffect(() => {
    if (!editor) return
    if (content === editor.getHTML()) return
    editor.commands.setContent(content, { emitUpdate: false })
  }, [editor, content])

  if (!editor) {
    return null
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)
    if (url === null) return // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className={cn('border border-border rounded-lg', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-2 bg-muted/50">
        {/* Heading buttons — toolbar "H1" emits <h2> (§8E-4) */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Heading 1"
          aria-label="Heading 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(editor.isActive('heading', { level: 2 }) && 'bg-accent')}
        >
          <Heading2 className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Heading 2"
          aria-label="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(editor.isActive('heading', { level: 3 }) && 'bg-accent')}
        >
          <Heading3 className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Heading 3"
          aria-label="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          className={cn(editor.isActive('heading', { level: 4 }) && 'bg-accent')}
        >
          <Heading4 className="size-4" aria-hidden="true" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        {/* Found 2026-08-21 (8E accessibility gap): every button below rendered with
            no accessible name at all — a bare icon SVG with no aria-label/title, so a
            screen reader announced each as unlabeled "button." Only the three heading
            buttons above had one. Fixed by giving every toolbar control both a title
            (visible tooltip on hover) and an aria-label (so the name doesn't depend on
            the icon being decorative-only) — same pattern the heading buttons already
            used, just applied consistently. */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Bold"
          aria-label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(editor.isActive('bold') && 'bg-accent')}
        >
          <Bold className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Italic"
          aria-label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(editor.isActive('italic') && 'bg-accent')}
        >
          <Italic className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Underline"
          aria-label="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(editor.isActive('underline') && 'bg-accent')}
        >
          <UnderlineIcon className="size-4" aria-hidden="true" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Add link"
          aria-label="Add link"
          onClick={setLink}
          className={cn(editor.isActive('link') && 'bg-accent')}
        >
          <LinkIcon className="size-4" aria-hidden="true" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Quote"
          aria-label="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(editor.isActive('blockquote') && 'bg-accent')}
        >
          <Quote className="size-4" aria-hidden="true" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Bullet list"
          aria-label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(editor.isActive('bulletList') && 'bg-accent')}
        >
          <List className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Numbered list"
          aria-label="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(editor.isActive('orderedList') && 'bg-accent')}
        >
          <ListOrdered className="size-4" aria-hidden="true" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Insert table"
          aria-label="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}
