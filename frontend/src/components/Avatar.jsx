import { STATUS_LABEL } from '../constants'

const HUES = 8

function hueIndex(name) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % HUES
}

function initials(name) {
  const words = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)
  return letters.toUpperCase()
}

/** Initials in a tinted circle; the colour is stable per company name. */
export default function Avatar({ name, size = 'md' }) {
  return (
    <span className={`avatar avatar-${size} hue-${hueIndex(name)}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

export function StatusBadge({ status }) {
  return (
    <span className={`status-badge st-${status}`}>
      <span className="dot" />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  return <span className={`prio-badge prio-${priority}`}>{priority}</span>
}
