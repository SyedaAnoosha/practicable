/**
 * RichText — the only dangerouslySetInnerHTML in the codebase that renders
 * author-controlled content. (`components/ui/chart.tsx` also has one, but it
 * injects a `<style>` block built entirely from this app's own internal theme
 * config — no user or admin input reaches it — a different risk category, not
 * an exception to the "no unsanitized user content" rule this file exists to hold.)
 *
 * week4_plan.md Phase 8 (8E-5): Renders sanitized HTML from the lesson editor.
 * Gated on `prose_sanitized` being non-null (Learn.tsx's own ternary); a null
 * `prose_sanitized` means the lesson/block predates this feature and keeps
 * rendering through the original whitespace-pre-line plain-text path untouched.
 *
 * A second client-side sanitize pass is applied as defence-in-depth — the
 * server-side sanitizer (html_sanitizer.py) is the real protection, but this
 * catches anything that slips past in the unlikely event the server path is
 * bypassed (a direct API call, a stale cache).
 */

interface RichTextProps {
  html: string
  className?: string
}

/**
 * Client-side HTML sanitiser — defence-in-depth.
 * Strips script tags, event handlers, and javascript: hrefs.
 * The server-side bleach sanitizer is the real protection; this catches
 * anything that slips past.
 */
function clientSanitize(html: string): string {
  return html
    // Strip <script> tags and their contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Strip event handlers (onclick, onerror, onload, etc.)
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Strip javascript: hrefs
    .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '')
    // Strip data: hrefs
    .replace(/href\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, '')
}

export function RichText({ html, className }: RichTextProps) {
  const sanitized = clientSanitize(html)

  return (
    <div
      className={`rich-text ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
