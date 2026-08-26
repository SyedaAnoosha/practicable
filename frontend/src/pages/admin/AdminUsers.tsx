import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, KeyRound, Loader2, Pencil, ShieldAlert, UserX } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string
  last_sign_in_at: string | null
  disabled_at: string | null
  created_at: string
  cursor: string
}

interface UserEntitlement {
  product_id: string
  product_name: string
  granted_via: string
  granted_at: string
}

interface UserOrder {
  order_id: string
  date: string
  amount: number
  currency: string
  status: string
}

interface UserDetail {
  id: string
  email: string
  name: string | null
  role: string
  last_sign_in_at: string | null
  disabled_at: string | null
  created_at: string
  entitlements: UserEntitlement[]
  orders: UserOrder[]
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`
}

/** Pull the backend's error envelope message, matching AdminQuestions/AdminTemplates.
 *  Falls back to pydantic's array-shaped 422 body before the generic message, so a
 *  validation failure (a malformed email) says what was wrong instead of "try again". */
function readError(err: unknown, fallback: string): string {
  const detail = (err as any)?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail[0]?.msg ?? fallback
  return detail?.error?.message ?? fallback
}

// ── Role change dialog ─────────────────────────────────────────────────────────

function RoleChangeDialog({
  user,
  onClose,
  onSubmit,
  isPending,
}: {
  user: UserRow
  onClose: () => void
  onSubmit: (reason: string, role: string) => void
  isPending: boolean
}) {
  const [reason, setReason] = useState('')
  const newRole = user.role === 'admin' ? 'member' : 'admin'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">
          {newRole === 'admin' ? 'Promote to admin' : 'Demote to member'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {newRole === 'admin'
            ? `Give ${user.email} admin access. They will be able to manage all content and users.`
            : `Remove admin access from ${user.email}. They will no longer be able to access the admin panel.`}
        </p>
        {newRole === 'admin' && user.role === 'member' && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            {user.disabled_at ? 'This user is currently deactivated.' : 'This user will gain admin access immediately.'}
          </p>
        )}
        <div className="mt-4">
          <label htmlFor="role-reason" className="block text-sm font-medium text-foreground">
            Reason (required)
          </label>
          <textarea
            id="role-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Why is this role change needed?"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={newRole === 'admin' ? 'primary' : 'destructive'}
            disabled={!reason.trim() || isPending}
            loading={isPending}
            onClick={() => onSubmit(reason, newRole)}
          >
            {newRole === 'admin' ? 'Promote' : 'Demote'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Deactivate dialog ──────────────────────────────────────────────────────────

function DeactivateDialog({
  user,
  onClose,
  onSubmit,
  isPending,
}: {
  user: UserRow
  onClose: () => void
  onSubmit: (reason: string) => void
  isPending: boolean
}) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">Deactivate user</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Deactivating <strong>{user.email}</strong> will prevent them from accessing any gated content. Their
          entitlements will be refused at the gate, but existing orders and records are preserved.
        </p>
        <div className="mt-4">
          <label htmlFor="deactivate-reason" className="block text-sm font-medium text-foreground">
            Reason (required)
          </label>
          <textarea
            id="deactivate-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Why is this user being deactivated?"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || isPending}
            loading={isPending}
            onClick={() => onSubmit(reason)}
          >
            Deactivate
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Edit user dialog ───────────────────────────────────────────────────────────

interface EditUserPayload {
  name?: string
  email?: string
  role?: string
  reason?: string
}

function EditUserDialog({
  user,
  onClose,
  onSubmit,
  onSendReset,
  isPending,
  isResetPending,
  errorMessage,
  resetStatus,
}: {
  user: UserRow
  onClose: () => void
  onSubmit: (payload: EditUserPayload) => void
  onSendReset: () => void
  isPending: boolean
  isResetPending: boolean
  errorMessage: string | null
  resetStatus: { kind: 'success' | 'error'; message: string } | null
}) {
  const [name, setName] = useState(user.name ?? '')
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [reason, setReason] = useState('')

  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase()
  const roleChanged = role !== user.role
  const nameChanged = name.trim() !== (user.name ?? '')
  const dirty = emailChanged || roleChanged || nameChanged

  // A role change is the one edit here that alters what this person can do, so it
  // carries the same reason-required expectation as the dedicated Role dialog.
  const reasonMissing = roleChanged && !reason.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">Edit user</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Update this practitioner's details. Every change is audited.
        </p>

        {/* Name */}
        <div className="mt-4">
          <label htmlFor="edit-name" className="block text-sm font-medium text-foreground">
            Name
          </label>
          <input
            id="edit-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="No name set"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Email */}
        <div className="mt-4">
          <label htmlFor="edit-email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {emailChanged && (
            /* This is the sign-in address, not just a contact field. The backend updates
               the Supabase auth record and the local row together or not at all, so this
               copy states the consequence plainly rather than letting an admin discover
               it when the user cannot log in. */
            <p className="mt-2 flex gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                This is the sign-in address. Changing it updates their Supabase login too —
                they must use <strong>{email.trim()}</strong> to sign in from now on. Their
                password is unchanged. If the auth update fails, nothing is saved.
              </span>
            </p>
          )}
        </div>

        {/* Role */}
        <div className="mt-4">
          <label htmlFor="edit-role" className="block text-sm font-medium text-foreground">
            Role
          </label>
          <select
            id="edit-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </div>

        {/* Reason — required for a role change */}
        {roleChanged && (
          <div className="mt-4">
            <label htmlFor="edit-reason" className="block text-sm font-medium text-foreground">
              Reason (required for role changes)
            </label>
            <textarea
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Why is this role change needed?"
            />
          </div>
        )}

        {errorMessage && (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {errorMessage}
          </p>
        )}

        {/* Password reset — a link is emailed; no password is ever set or shown here. */}
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="text-sm font-medium text-foreground">Password</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Passwords are held by Supabase, not by this app — no one here can read or set
            one. Send the user a reset link and they choose a new password themselves.
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            onClick={onSendReset}
            disabled={isResetPending}
            loading={isResetPending}
          >
            <KeyRound className="size-3" aria-hidden="true" />
            Send password reset email
          </Button>
          {resetStatus && (
            <p
              className={
                resetStatus.kind === 'success'
                  ? 'mt-2 text-xs text-emerald-600 dark:text-emerald-400'
                  : 'mt-2 text-xs text-destructive'
              }
            >
              {resetStatus.message}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!dirty || reasonMissing || isPending}
            loading={isPending}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                email: email.trim(),
                role,
                ...(reason.trim() ? { reason: reason.trim() } : {}),
              })
            }
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function AdminUsers() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null)
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null)
  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [resetStatus, setResetStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const { data: users, isLoading } = useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: () => api.get<UserRow[]>('/admin/users').then((r) => r.data),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role, reason }: { userId: string; role: string; reason: string }) =>
      api.post(`/admin/users/${userId}/role`, { role, reason }),
    onSuccess: () => {
      setRoleTarget(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      api.post(`/admin/users/${userId}/deactivate`, { reason }),
    onSuccess: () => {
      setDeactivateTarget(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: EditUserPayload }) =>
      api.patch<{ user: UserRow; email_auth_synced: boolean | null; warning: string | null }>(
        `/admin/users/${userId}`,
        payload,
      ),
    onSuccess: () => {
      setEditTarget(null)
      setResetStatus(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
    },
  })

  // Triggers an emailed reset LINK. The admin never sees or chooses a password —
  // Supabase owns the credential and the user sets it themselves from the link.
  const passwordResetMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      api.post<{ ok: boolean; sent_to: string | null; message: string }>(
        `/admin/users/${userId}/send-password-reset`,
      ),
    onSuccess: (res) => {
      setResetStatus({ kind: 'success', message: res.data.message })
    },
    onError: (err) => {
      setResetStatus({ kind: 'error', message: readError(err, 'Could not send the reset email.') })
    },
  })

  const loadDetail = async (user: UserRow) => {
    setSelectedUser(user)
    setLoadingDetail(true)
    try {
      const { data } = await api.get<UserDetail>(`/admin/users/${user.id}`)
      setDetailUser(data)
    } finally {
      setLoadingDetail(false)
    }
  }

  const filtered = search
    ? users?.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()))
    : users

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <PageTitle
        eyebrow="Admin"
        title="Users"
        description="View users, edit their details, manage roles, and deactivate accounts. All changes are audited."
      />

      {/* Search */}
      <div className="mt-6">
        <input
          type="search"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isLoading && (
        <div className="mt-8 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-sm border border-border bg-muted/40" />
          ))}
        </div>
      )}

      {!isLoading && filtered?.length === 0 && (
        <EmptyState className="mt-8" title="No users found." description="No users match your search." />
      )}

      {!isLoading && filtered && filtered.length > 0 && (
        <div className="mt-8 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left">Email</th>
                <th scope="col" className="px-4 py-2.5 text-left">Role</th>
                <th scope="col" className="px-4 py-2.5 text-left">Last sign-in</th>
                <th scope="col" className="px-4 py-2.5 text-left">Status</th>
                <th scope="col" className="px-4 py-2.5 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border transition-colors duration-150 hover:bg-muted/30">
                  <td className="h-11 px-4">
                    <button
                      onClick={() => loadDetail(u)}
                      className="text-left font-medium text-foreground hover:underline"
                    >
                      {u.email}
                    </button>
                    {u.name && (
                      <p className="text-xs text-muted-foreground">{u.name}</p>
                    )}
                  </td>
                  <td className="px-4">
                    <Badge variant={u.role === 'admin' ? 'success' : 'muted'}>{u.role}</Badge>
                  </td>
                  <td className="px-4 font-mono text-xs text-muted-foreground">
                    {formatDate(u.last_sign_in_at)}
                  </td>
                  <td className="px-4">
                    {u.disabled_at ? (
                      <Badge variant="warning">Deactivated</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </td>
                  <td className="px-4">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setResetStatus(null)
                          editMutation.reset()
                          passwordResetMutation.reset()
                          setEditTarget(u)
                        }}
                      >
                        <Pencil className="size-3" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRoleTarget(u)}>
                        <ShieldAlert className="size-3" aria-hidden="true" />
                        Role
                      </Button>
                      {!u.disabled_at && (
                        <Button size="sm" variant="ghost" onClick={() => setDeactivateTarget(u)}>
                          <UserX className="size-3" aria-hidden="true" />
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail slide-over */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setSelectedUser(null); setDetailUser(null) }} />
          <div className="relative ml-auto h-full w-full max-w-lg overflow-y-auto border-l border-border bg-background p-6 shadow-lg">
            <button
              onClick={() => { setSelectedUser(null); setDetailUser(null) }}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">{selectedUser.email}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{selectedUser.name || 'No name set'}</p>
            <div className="mt-3 flex gap-2">
              <Badge variant={selectedUser.role === 'admin' ? 'success' : 'muted'}>{selectedUser.role}</Badge>
              {selectedUser.disabled_at ? (
                <Badge variant="warning">Deactivated</Badge>
              ) : (
                <Badge variant="success">Active</Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Created: {formatDate(selectedUser.created_at)} · Last sign-in: {formatDate(selectedUser.last_sign_in_at)}
            </p>

            {loadingDetail ? (
              <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading details…
              </p>
            ) : detailUser && (
              <>
                {/* Entitlements */}
                <h3 className="mt-6 text-sm font-medium text-foreground">Entitlements</h3>
                {detailUser.entitlements.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No entitlements.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                    {detailUser.entitlements.map((e) => (
                      <li key={e.product_id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-sm text-foreground">{e.product_name}</p>
                          <p className="text-xs text-muted-foreground">via {e.granted_via}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(e.granted_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Orders */}
                <h3 className="mt-6 text-sm font-medium text-foreground">Orders</h3>
                {detailUser.orders.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No orders.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                    {detailUser.orders.map((o) => (
                      <li key={o.order_id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-sm text-foreground">{formatCurrency(o.amount, o.currency)}</p>
                          <p className="text-xs text-muted-foreground">{o.status}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{o.date}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      {editTarget && (
        <EditUserDialog
          user={editTarget}
          onClose={() => {
            setEditTarget(null)
            setResetStatus(null)
          }}
          onSubmit={(payload) => editMutation.mutate({ userId: editTarget.id, payload })}
          onSendReset={() => passwordResetMutation.mutate({ userId: editTarget.id })}
          isPending={editMutation.isPending}
          isResetPending={passwordResetMutation.isPending}
          errorMessage={
            editMutation.isError ? readError(editMutation.error, 'Could not save changes.') : null
          }
          resetStatus={resetStatus}
        />
      )}
      {roleTarget && (
        <RoleChangeDialog
          user={roleTarget}
          onClose={() => setRoleTarget(null)}
          onSubmit={(reason, role) => roleMutation.mutate({ userId: roleTarget.id, role, reason })}
          isPending={roleMutation.isPending}
        />
      )}
      {deactivateTarget && (
        <DeactivateDialog
          user={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onSubmit={(reason) => deactivateMutation.mutate({ userId: deactivateTarget.id, reason })}
          isPending={deactivateMutation.isPending}
        />
      )}
    </div>
  )
}
