import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, patch } from '../api'
import Avatar, { PriorityBadge } from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'
import { STATUSES, daysAgoLabel } from '../constants'

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }

function Card({ company, onMove, onOpen }) {
  return (
    <article
      className="kcard"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(company.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      tabIndex={0}
    >
      <div className="kcard-top">
        <Avatar name={company.name} size="sm" />
        <div className="kcard-title">
          <strong>{company.name}</strong>
          <span className="muted small">{company.sector || 'No sector'}</span>
        </div>
      </div>
      <div className="kcard-meta">
        <PriorityBadge priority={company.priority} />
        <span className="kcard-time"><Icon name="clock" size={13} /> {daysAgoLabel(company.days_since_contact)}</span>
        {company.pending_followups > 0 && <span className="pill warn">Follow up</span>}
      </div>
      <select
        aria-label={`Move ${company.name}`}
        className="kcard-select"
        value={company.status}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => onMove(company, e.target.value)}
      >
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </article>
  )
}

export default function Pipeline() {
  const [companies, setCompanies] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  const [dragOver, setDragOver] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    get('companies/').then(setCompanies).catch((err) => setError(err.message))
  }, [])

  const columns = useMemo(() => {
    if (!companies) return []
    const q = search.trim().toLowerCase()
    const visible = companies.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q) || c.sector.toLowerCase().includes(q)) &&
        (!priority || c.priority === priority),
    )
    return STATUSES.map((s) => ({
      ...s,
      items: visible
        .filter((c) => c.status === s.value)
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.name.localeCompare(b.name)),
    }))
  }, [companies, search, priority])

  const move = async (company, status) => {
    if (company.status === status) return
    const previous = companies
    setCompanies((list) => list.map((c) => (c.id === company.id ? { ...c, status } : c)))
    try {
      await patch(`companies/${company.id}/`, { status })
    } catch (err) {
      setCompanies(previous)
      setError(`Couldn't move ${company.name}: ${err.message}`)
    }
  }

  if (!companies) {
    return error ? <div className="empty-state error-text">{error}</div> : <div className="skeleton-grid"><div /><div /><div /></div>
  }

  return (
    <div className="page pipeline">
      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">{companies.length} companies · drag a card or use its dropdown to move it</p>
        </div>
        <div className="toolbar">
          <label className="search">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Search name or sector"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="segmented" role="group" aria-label="Filter by priority">
            {[['', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']].map(([value, label]) => (
              <button key={value} className={priority === value ? 'on' : ''} onClick={() => setPriority(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="board">
        {columns.map((col) => (
          <section
            key={col.value}
            className={`kcol st-${col.value} ${dragOver === col.value ? 'over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(col.value)
            }}
            onDragLeave={() => setDragOver((v) => (v === col.value ? null : v))}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(null)
              const company = companies.find((c) => String(c.id) === e.dataTransfer.getData('text/plain'))
              if (company) move(company, col.value)
            }}
          >
            <header className="kcol-head">
              <span className="dot" />
              <span className="kcol-title">{col.label}</span>
              <span className="count">{col.items.length}</span>
            </header>
            <div className="kcol-body">
              {col.items.length === 0 && <div className="kcol-empty">Drop here</div>}
              {col.items.map((c) => (
                <Card key={c.id} company={c} onMove={move} onOpen={() => navigate(`/companies/${c.id}`)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
