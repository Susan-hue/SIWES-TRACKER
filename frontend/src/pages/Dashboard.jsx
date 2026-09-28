import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'
import Avatar from '../components/Avatar.jsx'
import { BarList, ColumnChart } from '../components/Charts.jsx'
import Icon from '../components/Icon.jsx'
import { formatDate, pct } from '../constants'

function Tile({ icon, tone, label, value, sub }) {
  return (
    <div className="tile">
      <span className={`tile-icon tone-${tone}`}><Icon name={icon} size={20} /></span>
      <div>
        <div className="tile-label">{label}</div>
        <div className="tile-value">{value}</div>
        {sub && <div className="tile-sub">{sub}</div>}
      </div>
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

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function heroLine(totals, notContacted) {
  const due = totals.followups_due_today + totals.followups_overdue
  if (due) return `${due} follow up${due === 1 ? '' : 's'} waiting for you today.`
  if (!totals.contacted) return `${totals.companies} companies researched and ready. Time to send the first message.`
  return `${notContacted} companies still to contact. Keep the momentum going.`
}

export default function Dashboard({ onAdd }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    get('dashboard/').then(setData).catch((err) => setError(err.message))
  }, [])

  if (error) return <div className="empty-state error-text">{error}</div>
  if (!data) return <div className="skeleton-grid"><div /><div /><div /><div /></div>

  const { totals } = data
  const notContacted = data.funnel.find((s) => s.status === 'not_contacted')?.count ?? 0
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="hero-date">{today}</div>
          <h1>{greeting()}</h1>
          <p>{heroLine(totals, notContacted)}</p>
        </div>
        <div className="hero-actions">
          <Link to="/pipeline" className="btn light"><Icon name="pipeline" /> Open pipeline</Link>
          <button className="btn glass" onClick={onAdd}><Icon name="plus" /> Add company</button>
        </div>
      </section>

      <section className="tiles">
        <Tile icon="building" tone="blue" label="Companies" value={totals.companies} sub={`${totals.contacted} contacted`} />
        <Tile icon="send" tone="violet" label="Messages sent" value={totals.messages_sent} sub={`${totals.contacted} companies reached`} />
        <Tile
          icon="trend"
          tone="green"
          label="Response rate"
          value={pct(totals.response_rate)}
          sub={totals.contacted ? `${totals.responded} of ${totals.contacted} replied` : 'Nothing sent yet'}
        />
        <Tile
          icon="bell"
          tone="amber"
          label="Follow ups today"
          value={totals.followups_due_today}
          sub={totals.followups_overdue ? `${totals.followups_overdue} overdue` : 'None overdue'}
        />
      </section>

      <div className="grid-main">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Follow ups due</h2>
              <p className="card-sub">Created automatically after a week of silence</p>
            </div>
          </div>
          {data.due_followups.length ? (
            <ul className="due-list">
              {data.due_followups.map((f) => (
                <li key={f.id}>
                  <Link to={`/companies/${f.company}`} className="due-row">
                    <Avatar name={f.company_name} />
                    <div className="due-main">
                      <strong>{f.company_name}</strong>
                      <span className="muted small">{f.has_draft ? 'Draft ready to review' : 'No draft yet'}</span>
                    </div>
                    <span className={`pill ${f.overdue ? 'warn' : 'info'}`}>
                      {f.overdue ? `Overdue · ${formatDate(f.due_date)}` : 'Due today'}
                    </span>
                    <Icon name="chevron" className="muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <span className="empty-icon"><Icon name="check" size={22} /></span>
              <strong>You're all caught up</strong>
              <span className="muted small">New follow ups appear here when a company goes quiet.</span>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Pipeline</h2>
              <p className="card-sub">Companies by status</p>
            </div>
            <Link to="/pipeline" className="link-more">View board <Icon name="chevron" size={14} /></Link>
          </div>
          <BarList
            rows={data.funnel.map((s) => ({
              key: s.status,
              label: s.label,
              dot: s.status,
              value: s.count,
              display: String(s.count),
              tip: `${s.label}: ${s.count} ${s.count === 1 ? 'company' : 'companies'}`,
            }))}
          />
        </section>
      </div>

      <div className="grid-3">
        <section className="card">
          <h2>Outreach per week</h2>
          <p className="card-sub">Companies first contacted, last 12 weeks</p>
          <ColumnChart
            points={data.weekly_volume.map((w) => ({
              key: w.week,
              label: formatDate(w.week),
              value: w.count,
              tip: `Week of ${formatDate(w.week)}: ${w.count} contacted`,
            }))}
          />
          <div className="mini-stat">
            <Icon name="clock" size={16} />
            Average time to first reply
            <strong>
              {totals.avg_days_to_first_reply === null ? '–' : `${totals.avg_days_to_first_reply} days`}
            </strong>
          </div>
        </section>

        <section className="card">
          <h2>Response by channel</h2>
          <p className="card-sub">Replies on the channel you messaged</p>
          <BarList max={1} rows={data.by_channel.map((c) => rateRow(c.channel, c.label, c))} />
        </section>

        <section className="card">
          <h2>Response by sector</h2>
          <p className="card-sub">Share of contacted companies that replied</p>
          <BarList
            max={1}
            stacked
            emptyText="Log your first sent message to see sector results."
            rows={data.by_sector.map((s) => rateRow(s.sector, s.sector, s))}
          />
        </section>
      </div>
    </div>
  )
}
