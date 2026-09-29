import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, patch } from '../api'
import { PageHeader, PriorityBadge } from '../components/Badges.jsx'
import Icon from '../components/Icon.jsx'
import { STATUSES, daysAgoLabel } from '../constants'
import useRefresh from '../useRefresh'

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }
const VIEW_KEY = 'siwes-pipeline-view'

function StatusSelect({ company, onMove }) {
  return (
    <select
      aria-label={`Status of ${company.name}`}
      className="inline-select"
      value={company.status}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onChange={(e) => onMove(company, e.target.value)}
    >
      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  )
}

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
      <div className="kcard-name">{company.name}</div>
      <div className="muted small">{company.sector || 'No sector'}</div>
      <div className="kcard-meta">
        <PriorityBadge priority={company.priority} />
        <span className="muted small">{daysAgoLabel(company.days_since_contact)}</span>
      </div>
      {company.pending_followups > 0 && <div className="kcard-flag">Follow up due</div>}
      <StatusSelect company={company} onMove={onMove} />
    </article>
  )
}

export default function Pipeline() {
  const [companies, setCompanies] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  const [sector, setSector] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) || 'board'
    } catch {
      return 'board'
    }
  })
  const [dragOver, setDragOver] = useState(null)
  const navigate = useNavigate()

  useRefresh(() => {
    get('companies/').then(setCompanies).catch((err) => setError(err.message))
  })

  const changeView = (v) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* ignore */
    }
  }

  const sectors = useMemo(
    () => [...new Set((companies || []).map((c) => c.sector).filter(Boolean))].sort(),
    [companies],
  )

  const visible = useMemo(() => {
    if (!companies) return []
    const q = search.trim().toLowerCase()
    return companies
      .filter(
        (c) =>
          (!q || c.name.toLowerCase().includes(q) || c.sector.toLowerCase().includes(q)) &&
          (!priority || c.priority === priority) &&
          (!sector || c.sector === sector),
      )
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.name.localeCompare(b.name))
  }, [companies, search, priority, sector])

  const counts = useMemo(() => {
    const out = {}
    for (const c of visible) out[c.status] = (out[c.status] || 0) + 1
    return out
  }, [visible])

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

  const open = (c) => navigate(`/companies/${c.id}`)
  const rows = statusFilter ? visible.filter((c) => c.status === statusFilter) : visible

  return (
    <div className="page wide">
      <PageHeader
        title="Pipeline"
        description="Every company you are reaching out to, by stage. Drag a card or change its status to move it."
        actions={
          <div className="toggle" role="group" aria-label="View">
            <button className={view === 'board' ? 'on' : ''} onClick={() => changeView('board')}>
              <Icon name="pipeline" size={14} /> Board
            </button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => changeView('list')}>
              <Icon name="dashboard" size={14} /> List
            </button>
          </div>
        }
      />

      {view === 'list' && (
        <div className="pills" role="group" aria-label="Filter by status">
          <button className={!statusFilter ? 'on' : ''} onClick={() => setStatusFilter('')}>All</button>
          {STATUSES.map((s) => (
            <button key={s.value} className={statusFilter === s.value ? 'on' : ''} onClick={() => setStatusFilter(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="filters">
        <label className="filter search-filter">
          <span className="label">Search</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or sector" />
        </label>
        <label className="filter">
          <span className="label">Sector</span>
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">All</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="filter">
          <span className="label">Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      {view === 'list' ? (
        <div className="panel flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Company</th><th>Sector</th><th>Priority</th><th>Last contact</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} onClick={() => open(c)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(c)}>
                    <td className="strong">
                      {c.name}
                      {c.pending_followups > 0 && <span className="flag-dot" title="Follow up due" />}
                    </td>
                    <td className="muted">{c.sector}</td>
                    <td><PriorityBadge priority={c.priority} /></td>
                    <td className="muted nowrap">{daysAgoLabel(c.days_since_contact)}</td>
                    <td><StatusSelect company={c} onMove={move} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="empty">No companies match these filters.</p>}
          </div>
        </div>
      ) : (
        <div className="board">
          {STATUSES.map((col) => (
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
                <span className="label">{col.label}</span>
                <span className="count">{counts[col.value] || 0}</span>
              </header>
              <div className="kcol-body">
                {visible.filter((c) => c.status === col.value).map((c) => (
                  <Card key={c.id} company={c} onMove={move} onOpen={() => open(c)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
