import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'
import { BarList, ColumnChart } from '../components/Charts.jsx'
import { formatDate, pct } from '../constants'

function Tile({ label, value, sub }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  )
}

const rateRow = (key, label, r) => ({
  key,
  label,
  value: r.rate ?? 0,
  display: r.contacted ? `${pct(r.rate)}` : 'none sent',
  tip: r.contacted ? `${label}: ${r.responded} of ${r.contacted} replied` : `${label}: not contacted yet`,
})

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    get('dashboard/').then(setData).catch((err) => setError(err.message))
  }, [])

  if (error) return <p className="error-text">{error}</p>
  if (!data) return <p className="muted">Loading…</p>

  const { totals } = data
  const dueCount = totals.followups_due_today + totals.followups_overdue

  return (
    <div className="dashboard">
      <section className="tiles">
        <Tile label="Companies" value={totals.companies} sub={`${totals.contacted} contacted`} />
        <Tile label="Messages sent" value={totals.messages_sent} />
        <Tile
          label="Response rate"
          value={pct(totals.response_rate)}
          sub={totals.contacted ? `${totals.responded} of ${totals.contacted} replied` : 'Nothing sent yet'}
        />
        <Tile
          label="Follow ups due today"
          value={totals.followups_due_today}
          sub={totals.followups_overdue ? `${totals.followups_overdue} overdue` : 'None overdue'}
        />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Follow ups due</h2>
          <span className="muted small">{dueCount ? `${dueCount} waiting` : 'All clear'}</span>
        </div>
        {data.due_followups.length ? (
          <ul className="due-list">
            {data.due_followups.map((f) => (
              <li key={f.id}>
                <Link to={`/companies/${f.company}`}>{f.company_name}</Link>
                <span className={`pill ${f.overdue ? 'warn' : ''}`}>
                  {f.overdue ? `Overdue since ${formatDate(f.due_date)}` : 'Due today'}
                </span>
                <span className="muted small">{f.has_draft ? 'Draft ready' : 'No draft yet'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Nothing due. Follow ups are created automatically after a week of silence.</p>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Pipeline</h2>
          <p className="muted small">Companies by status</p>
          <BarList
            rows={data.funnel.map((s) => ({
              key: s.status,
              label: s.label,
              value: s.count,
              display: String(s.count),
              tip: `${s.label}: ${s.count} ${s.count === 1 ? 'company' : 'companies'}`,
            }))}
          />
        </section>

        <section className="card">
          <h2>Outreach per week</h2>
          <p className="muted small">Companies first contacted, last 12 weeks</p>
          <ColumnChart
            points={data.weekly_volume.map((w) => ({
              key: w.week,
              label: formatDate(w.week),
              value: w.count,
              tip: `Week of ${formatDate(w.week)}: ${w.count} contacted`,
            }))}
          />
          <p className="muted small">
            Average time to first reply:{' '}
            <strong>
              {totals.avg_days_to_first_reply === null ? '–' : `${totals.avg_days_to_first_reply} days`}
            </strong>
          </p>
        </section>

        <section className="card">
          <h2>Response rate by channel</h2>
          <p className="muted small">Share of companies messaged on a channel that replied there</p>
          <BarList max={1} rows={data.by_channel.map((c) => rateRow(c.channel, c.label, c))} />
        </section>

        <section className="card">
          <h2>Response rate by sector</h2>
          <p className="muted small">Share of contacted companies that replied</p>
          <BarList
            max={1}
            emptyText="Log a sent message to start seeing sector results."
            rows={data.by_sector.map((s) => rateRow(s.sector, s.sector, s))}
          />
        </section>
      </div>
    </div>
  )
}
