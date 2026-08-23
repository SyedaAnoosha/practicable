import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'

interface Certificate {
  id: string
  course_title: string
  issued_at: string
  verification_code: string
  revoked: boolean
}

export function useCertificates() {
  return useQuery<Certificate[]>({
    queryKey: [...queryKeys.me.library(), 'certificates'],
    queryFn: () => api.get<Certificate[]>('/me/certificates').then((r) => r.data),
  })
}
