import { PRIORITY_LABEL, STATUS_LABEL } from '../constants'

export function StatusBadge({ status }) {
  return (
    <span className={`status-badge st-${status}`}>
      <span className="dot" />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  return <span className={`prio prio-${priority}`}>{PRIORITY_LABEL[priority]}</span>
}

export function PageHeader({ eyebrow = 'SIWES Outreach', title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
