// Opening a legacy lesson/block in RichTextEditor must not hand Tiptap the raw
// plain-text body directly as `content` — Tiptap's `content` prop expects HTML, and a
// bare string with `\n` line breaks but no tags collapses into one giant unstyled
// paragraph (every newline becomes a space). This converts a legacy plain-text body
// into one `<p>` per blank-line-separated paragraph before it ever reaches Tiptap, so
// an admin opening old content sees real paragraph breaks to work from.
//
// Deliberately does NOT try to guess headings, bullets or numbered lists from the plain
// text (e.g. a line starting "1." is not turned into an `<li>`) — that would silently
// rewrite content the admin never asked to have restructured. Paragraph breaks are the
// one transformation safe to apply automatically, because whitespace-pre-line (the
// existing plain-text render path) already treats them as visually equivalent.
//
// HTML-escaped so an existing body containing a literal `<` or `&` renders as that
// character, not as a tag — don't reinterpret old content.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function plainTextToEditorHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return ''

  return paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}
