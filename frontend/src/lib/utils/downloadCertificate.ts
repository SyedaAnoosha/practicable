import { api } from '@/lib/api/client'

/**
 * Fetch a certificate's short-lived presigned URL, then open it. Not a plain
 * `<a href download>`: the endpoint returns JSON (`{download_url}`), not the file, and
 * it is authenticated — an `<a>` sends no Authorization header and would 401. Shared
 * between Dashboard and CourseDetail so "View certificate" gives the learner their own
 * certificate, not the public /verify page's record.
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
