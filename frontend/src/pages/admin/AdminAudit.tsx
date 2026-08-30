import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Loader2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'

interface AuditLogRow {
  id: string
  actor_email: string | null
  action: string
  target_type: string
  target_id: string
  context: string | null
  created_at: string
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ACTION_VARIANTS: Record<string, 'success' | 'warning' | 'destructive' | 'muted' | 'secondary'> = {
  manual_entitlement_grant: 'success',
  refund: 'destructive',
  change_user_role: 'warning',
  deactivate_user: 'warning',
  publish_course: 'success',
  publish_template: 'success',
  unpublish_course: 'muted',
  unpublish_template: 'muted',
  change_product_price: 'warning',
  admin_access_bypass: 'muted',
  update_setting: 'muted',
}

export function AdminAudit() {
  const [actionFilter, setActionFilter] = useState<string | null>(null)

  const { data: logs, isLoading } = useQuery({
    queryKey: [...queryKeys.admin.audit(), actionFilter],
    queryFn: () => {
      const params = actionFilter ? `?action=${actionFilter}` : ''
      return api.get<AuditLogRow[]>(`/admin/audit${params}`).then((r) => r.data)
    },
  })

  // Derive available actions from current data for filter chips
  const availableActions = [...new Set((logs ?? []).map((l) => l.action))].sort()

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <PageTitle
        eyebrow="Admin"
        title="Audit log"
        description="Every admin action recorded. Newest first. Filterable by action type."
      />

      {/* Action filter chips */}
      {availableActions.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActionFilter(null)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              actionFilter === null
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            All
          </button>
          {availableActions.map((action) => (
            <button
              key={action}
              onClick={() => setActionFilter(action)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                actionFilter === action
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {action.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading audit log…
        </p>
      ) : (
        <ul className="mt-8 flex flex-col divide-y divide-border border-t border-border">
          {logs?.map((log) => {
            const variant = ACTION_VARIANTS[log.action] ?? 'secondary'
            let contextObj: Record<string, unknown> | null = null
            try {
              contextObj = log.context ? JSON.parse(log.context) : null
            } catch {
              // Context is not JSON — display as-is
            }
            return (
              <li key={log.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={variant}>{log.action.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {log.target_type}/{log.target_id.slice(0, 8)}…
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.actor_email ?? 'System (no actor)'}
                    </p>
                    {contextObj && (
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                        {JSON.stringify(contextObj, null, 2)}
                      </pre>
                    )}
                  </div>
                  <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {formatDate(log.created_at)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {logs?.length === 0 && (
        <EmptyState
          className="mt-8"
          icon={ClipboardList}
          title="No audit entries yet."
          description="Admin actions will appear here as they happen."
        />
      )}
    </div>
  )
}
