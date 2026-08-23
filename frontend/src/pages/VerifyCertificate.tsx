import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Award, ShieldCheck, XCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Card } from '@/components/ui/Card'

interface VerifyResult {
  learner_name: string
  course_title: string
  issued_at: string
  revoked: boolean
  revoked_reason: string | null
}

/**
 * Public certificate verification page. A stranger checking a certificate
 * is not a member and must not land in member chrome — mounted in
 * MarketingLayout, not MemberLayout.
 */
export function VerifyCertificate() {
  const { code } = useParams<{ code: string }>()

  const { data, isLoading, error } = useQuery<VerifyResult>({
    queryKey: ['verify', code],
    queryFn: () => api.get<VerifyResult>(`/verify/${code}`).then((r) => r.data),
    enabled: !!code,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">Verifying certificate…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center px-5">
        <Card className="w-full p-8 text-center">
          <XCircle className="mx-auto size-12 text-destructive" aria-hidden="true" />
          <h1 className="mt-4 text-h3 font-semibold text-foreground">Certificate not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This verification code does not match any issued certificate. Please check
            the code and try again.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center px-5">
      <Card className="w-full p-8 text-center">
        {data.revoked ? (
          <XCircle className="mx-auto size-12 text-destructive" aria-hidden="true" />
        ) : (
          <ShieldCheck className="mx-auto size-12 text-success" aria-hidden="true" />
        )}

        <h1 className="mt-4 text-h3 font-semibold text-foreground">
          {data.revoked ? 'Certificate Revoked' : 'Certificate Verified'}
        </h1>

        <div className="mt-6 space-y-3 text-left">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Learner</p>
            <p className="mt-1 text-sm font-medium text-foreground">{data.learner_name}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Course</p>
            <p className="mt-1 text-sm font-medium text-foreground">{data.course_title}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issued</p>
            <p className="mt-1 text-sm text-foreground">
              {new Date(data.issued_at).toLocaleDateString('en-AU', { dateStyle: 'long' })}
            </p>
          </div>
          {data.revoked && (
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">
                This certificate has been revoked{data.revoked_reason ? `: ${data.revoked_reason}` : ''}.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Award className="size-3" aria-hidden="true" />
          <span>Practicable Certificate of Completion</span>
        </div>
      </Card>
    </div>
  )
}
