// Converts a legacy plain-text lesson/block body into one `<p>` per blank-line-separated
// paragraph before it reaches Tiptap, whose `content` prop expects HTML (a bare string
// with `\n` collapses into one unstyled paragraph).
//
// Does NOT guess headings, bullets or lists from the text ("1." is not turned into an
// `<li>`) — paragraph breaks are the one transformation safe to apply automatically.
// HTML-escaped so a literal `<` or `&` renders as that character.
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
