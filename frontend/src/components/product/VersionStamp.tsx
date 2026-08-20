import { History } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface VersionStampProps {
  version?: string
  lastReviewedAt?: string
  className?: string
}

// week4_plan.md §20.4 — `v1.2 · reviewed 17 Aug 2026`. Unset version renders nothing;
// unset lastReviewedAt with a set version renders `v1.2` alone (the absence rule).
export const VersionStamp = ({ version, lastReviewedAt, className }: VersionStampProps) => {
  if (!version && !lastReviewedAt) return null

  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const parts = []
  if (version) parts.push(`v${version}`)
  if (lastReviewedAt) parts.push(`reviewed ${formatDate(lastReviewedAt)}`)

  return (
    <div className={cn('flex items-center gap-1.5 font-mono text-xs text-gold-strong', className)}>
      <History className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="tabular-nums">{parts.join(' · ')}</span>
    </div>
  )
}
