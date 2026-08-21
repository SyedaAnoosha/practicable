import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Settings } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { FieldError } from '@/components/ui/FieldError'
import { required, useFieldValidation } from '@/lib/useFieldValidation'
import { useAutosave } from '@/lib/useAutosave'
import { AutosaveIndicator } from '@/components/admin/AutosaveIndicator'

interface ConfigStatusItem {
  name: string
  required: boolean
  is_set: boolean
}

interface SettingItem {
  key: string
  value: string
  updated_at: string | null
  updated_by: string | null
}

const FIELD_LABELS: Record<string, string> = {
  seller_legal_name: 'Seller legal name',
  mailjet_sender_email: 'Mailjet sender email',
  mailjet_sender_name: 'Mailjet sender name',
  owner_notification_email: 'Owner notification email',
  frontend_url: 'Frontend URL',
}

const REQUIRED_FIELDS = ['frontend_url']

export function AdminSettings() {
  const queryClient = useQueryClient()

  const { data: configStatus, isLoading: statusLoading } = useQuery({
    queryKey: [...queryKeys.admin.settings(), 'status'],
    queryFn: () => api.get<ConfigStatusItem[]>('/admin/config-status').then((r) => r.data),
  })

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: queryKeys.admin.settings(),
    queryFn: () => api.get<SettingItem[]>('/admin/settings').then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.put(`/admin/settings/${key}`, { key, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.settings() })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.settings(), 'status'] })
    },
  })

  const handleSave = (key: string, value: string) => updateMutation.mutateAsync({ key, value })

  if (statusLoading || settingsLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading settings…
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <PageTitle
        eyebrow="Admin"
        title="Settings"
        description="Operational configuration. Changes take effect immediately."
      />

      {/* Configuration status panel — visually separated from editable fields */}
      {configStatus && configStatus.length > 0 && (
        <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
          <h2 className="text-sm font-medium text-foreground">Configuration status</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Which operational keys have values. Secrets are never shown here.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {configStatus.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">{FIELD_LABELS[item.name] ?? item.name}</span>
                <Badge variant={item.is_set ? 'success' : item.required ? 'warning' : 'muted'}>
                  {item.is_set ? 'Set' : item.required ? 'Required, not set' : 'Not set'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editable fields */}
      {settings && settings.length > 0 ? (
        <div className="mt-8 flex flex-col gap-4">
          {settings.map((s) => (
            <SettingField
              key={s.key}
              setting={s}
              isRequired={REQUIRED_FIELDS.includes(s.key)}
              onSave={(value) => handleSave(s.key, value)}
              isPending={updateMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-8"
          icon={Settings}
          title="No settings configured."
          description="Operational settings will appear here."
        />
      )}
    </div>
  )
}

function SettingField({
  setting,
  isRequired,
  onSave,
  isPending,
}: {
  setting: SettingItem
  isRequired: boolean
  onSave: (value: string) => Promise<unknown>
  isPending: boolean
}) {
  // Controlled input — use setting.key as local state to avoid re-rendering
  // the entire page on every keystroke
  const [localValue, setLocalValue] = useState(setting.value)

  const label = FIELD_LABELS[setting.key] ?? setting.key

  // week2_plan.md §20.8 — "Inline validation on blur, not on submit, and a valid field
  // is never cleared because another failed." Only the required field carries a rule;
  // an optional field has nothing to validate.
  const v = useFieldValidation<{ value: string }>(
    isRequired ? { value: required(label) } : {},
  )

  // week2_plan.md §20.8's autosave — the same "losing what was typed" failure mode
  // AdminCourses.tsx's rich-text drafts close, applied here to operational config.
  const autosave = useAutosave({
    value: localValue,
    onSave: async () => {
      if (isRequired && !v.validateAll({ value: localValue })) {
        throw new Error('validation failed') // keeps the indicator honest, never saves invalid
      }
      await onSave(localValue)
    },
  })

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <label htmlFor={`setting-${setting.key}`} className="text-sm font-medium text-foreground">
          {label}
          {isRequired && <span className="ml-1 text-destructive">*</span>}
        </label>
        <div className="flex items-center gap-3">
          <AutosaveIndicator status={autosave.status} savedAt={autosave.savedAt} />
          <Button size="sm" disabled={isPending} loading={isPending} onClick={() => autosave.saveNow()}>
            Save
          </Button>
        </div>
      </div>
      <input
        id={`setting-${setting.key}`}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => isRequired && v.onBlur('value', localValue)}
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder={`Enter ${label.toLowerCase()}`}
      />
      <FieldError message={v.errorFor('value')} />
      {setting.updated_at && (
        <p className="mt-1 text-xs text-muted-foreground">
          Last updated: {new Date(setting.updated_at).toLocaleDateString('en-AU')} by {setting.updated_by ?? 'unknown'}
        </p>
      )}
    </div>
  )
}
