/**
 * RichTextEditor — Tiptap-based editor for lesson prose and block text.
 *
 * week4_plan.md Phase 8 (8E-4): Heading levels are capped at h2-h4.
 * A lesson body's <h1> would compete with the page's own PageTitle <h1>,
 * which §22 forbids and axe will flag.  The toolbar's first heading button
 * therefore emits <h2>, not <h1>.  Three visible levels — h2/h3/h4 — styled
 * at the §13.1 rungs the design already defines.
 *
 * week4_plan.md Phase 8 (8E-8): Link and Underline extensions installed
 * per W4-R13.
 */
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
        class: 'rich-text prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  })

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
          title="Heading 1 (renders as h2 — h1 is reserved for the page title)"
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
          title="Heading 2 (renders as h3)"
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
          title="Heading 3 (renders as h4)"
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
