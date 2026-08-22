import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { Button } from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'

interface LeadRow {
  id: string
  email: string
  source: string | null
  created_at: string
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function AdminLeads() {
  const [exporting, setExporting] = useState(false)

  const { data: leads, isLoading } = useQuery({
    queryKey: queryKeys.admin.leads(),
    queryFn: () => api.get<LeadRow[]>('/admin/leads').then((r) => r.data),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const { data } = await api.get('/admin/leads/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'leads.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <PageTitle
        eyebrow="Admin"
        title="Leads"
        description="Sign-ups from the free lead magnet. Newest first."
        action={
          leads && leads.length > 0 ? (
            <Button variant="ghost" size="sm" loading={exporting} onClick={handleExport}>
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="mt-8 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-sm border border-border bg-muted/40" />
          ))}
        </div>
      ) : (
        <ul className="mt-8 flex flex-col divide-y divide-border border-t border-border">
          {leads?.map((l) => (
            <li key={l.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-sans font-medium text-foreground">{l.email}</p>
                  {l.source && (
                    <p className="mt-0.5 text-xs text-muted-foreground">Source: {l.source}</p>
                  )}
                </div>
                <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {formatDate(l.created_at)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {leads?.length === 0 && (
        <EmptyState
          className="mt-8"
          title="No leads yet."
          description="Sign-ups will appear here as people join the free lead magnet."
        />
      )}
    </div>
  )
}
