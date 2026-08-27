import { api } from '@/lib/api/client'

/**
 * Fetch a certificate's short-lived presigned URL, then open it.
 *
 * Two reasons this is not a plain `<a href download>`:
 *
 *  - `GET /me/certificates/{id}/download` returns JSON (`{download_url}`), not the
 *    file. It renders the PDF on first call and presigns it; the browser must follow
 *    the presigned URL it hands back, not the endpoint itself.
 *  - The endpoint is authenticated. An `<a>` sends no Authorization header, so the
 *    request would 401 — and pointing it at `/api/v1/…` is not even where the API lives
 *    (`VITE_API_BASE_URL` is the origin, with no `/api/v1` prefix), so it would resolve
 *    against the SPA origin and return the index page.
 *
 * Shared between Dashboard and CourseDetail so "View certificate" gives the learner
 * their own certificate rather than the public /verify page's stranger's-eye
 * verification record.
 *
 * @returns true when a download was opened, false when it failed.
 */
export async function downloadCertificate(certificateId: string): Promise<boolean> {
  try {
    const { data } = await api.get<{ download_url: string }>(
      `/me/certificates/${certificateId}/download`,
    )
    // `noopener` because this is a third-party storage origin.
    window.open(data.download_url, '_blank', 'noopener,noreferrer')
    return true
  } catch {
    // The caller decides whether to surface this. A failed render is retryable: the
    // learner still holds the certificate and the next click re-attempts it.
    return false
  }
}
