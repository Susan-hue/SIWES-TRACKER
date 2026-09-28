import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, patch } from '../api'
import { PRIORITY_LABEL, STATUSES, daysAgoLabel } from '../constants'

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
        <strong>{company.name}</strong>
        <span className={`prio prio-${company.priority}`}>{PRIORITY_LABEL[company.priority]}</span>
      </div>
      <div className="muted small">{company.sector || 'No sector'}</div>
      <div className="kcard-bottom">
        <span className="small">{daysAgoLabel(company.days_since_contact)}</span>
        {company.pending_followups > 0 && <span className="pill">Follow up</span>}
      </div>
      <select
        aria-label={`Move ${company.name}`}
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

  if (!companies) return error ? <p className="error-text">{error}</p> : <p className="muted">Loading…</p>

  return (
    <div className="pipeline">
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name or sector"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by priority">
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <span className="muted small hide-narrow">Drag cards between columns, or use the dropdown on a card.</span>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="board">
        {columns.map((col) => (
          <section
            key={col.value}
            className={`kcol ${dragOver === col.value ? 'over' : ''}`}
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
              <span>{col.label}</span>
              <span className="count">{col.items.length}</span>
            </header>
            <div className="kcol-body">
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
