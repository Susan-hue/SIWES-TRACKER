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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n) => String(n).padStart(2, '0')
const shortDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${pad(d.getFullYear() % 100)}`

// "29 Aug 26, 14:05"
export function formatDateTime(iso) {
  const d = new Date(iso)
  return `${shortDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// "29 Aug 26". Date-only strings ("2026-09-28") must not shift across time zones.
export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return shortDate(new Date(y, m - 1, d))
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
