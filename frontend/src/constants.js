export const STATUSES = [
  { value: 'not_contacted', label: 'Not Contacted' },
  { value: 'sent', label: 'Sent' },
  { value: 'replied', label: 'Opened/Replied' },
  { value: 'in_conversation', label: 'In Conversation' },
  { value: 'interview', label: 'Interview' },
  { value: 'closed_won', label: 'Closed-Won' },
  { value: 'closed_lost', label: 'Closed-Lost' },
]

export const CHANNELS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'email', label: 'Email' },
]

export const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const labelOf = (list) => Object.fromEntries(list.map((o) => [o.value, o.label]))
export const STATUS_LABEL = labelOf(STATUSES)
export const CHANNEL_LABEL = labelOf(CHANNELS)
export const PRIORITY_LABEL = labelOf(PRIORITIES)

export const pct = (rate) => (rate === null || rate === undefined ? '–' : `${Math.round(rate * 100)}%`)

export function daysAgoLabel(days) {
  if (days === null || days === undefined) return 'No contact yet'
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function formatDate(iso) {
  // Date-only strings ("2026-09-28") must not shift across time zones.
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export const emptyCompany = {
  name: '',
  sector: '',
  channels: [],
  fit_rationale: '',
  priority: 'medium',
  website: '',
  instagram: '',
  linkedin: '',
  email: '',
  status: 'not_contacted',
}
