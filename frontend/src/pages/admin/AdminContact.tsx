import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { PageTitle } from '@/components/ui/PageTitle'
import { Badge } from '@/components/ui/Badge'

interface ContactMessage {
  id: string
  name: string
  email: string
  enquiry_type: string | null
  message: string
  notified: boolean
  created_at: string
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function AdminContact() {
  const [notifiedFilter, setNotifiedFilter] = useState<boolean | null>(null)

  const { data: messages, isLoading } = useQuery({
    queryKey: ['admin', 'contact', notifiedFilter],
    queryFn: () => {
      const params = notifiedFilter !== null ? `?notified=${notifiedFilter}` : ''
      return api.get<ContactMessage[]>(`/admin/contact${params}`).then((r) => r.data)
    },
  })

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <PageTitle
        eyebrow="Contact inbox"
        title="Contact messages"
        description="Messages from the public contact form. Filter by notification state to find messages that failed to send."
      />

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setNotifiedFilter(null)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            notifiedFilter === null
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setNotifiedFilter(false)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            notifiedFilter === false
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          Not notified
        </button>
        <button
          onClick={() => setNotifiedFilter(true)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            notifiedFilter === true
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          Notified
        </button>
      </div>

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading messages…
        </p>
      ) : (
        <ul className="mt-8 flex flex-col divide-y divide-border border-t border-border">
          {messages?.map((m) => (
            <li key={m.id} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-sans font-medium text-foreground">{m.name}</p>
                    <Badge variant={m.notified ? 'success' : 'warning'}>
                      {m.notified ? 'Notified' : 'Not notified'}
                    </Badge>
                    {m.enquiry_type && <span className="text-xs text-muted-foreground">{m.enquiry_type}</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{m.email}</p>
                  <p className="mt-2 text-sm text-foreground">{m.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {messages?.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">
          {notifiedFilter === false
            ? 'No unnotified messages.'
            : notifiedFilter === true
            ? 'No notified messages.'
            : 'No contact messages yet.'}
        </p>
      )}
    </div>
  )
}
