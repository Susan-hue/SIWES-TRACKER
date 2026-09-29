import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get } from '../api'
import { PageHeader } from '../components/Badges.jsx'
import { BarList, ColumnChart } from '../components/Charts.jsx'
import Icon from '../components/Icon.jsx'
import NotificationBanner from '../components/NotificationBanner.jsx'
import { formatDate, pct } from '../constants'
import useRefresh from '../useRefresh'

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

const rateRow = (key, label, r) => ({
  key,
  label,
  value: r.rate ?? 0,
  display: r.contacted ? `${pct(r.rate)}` : '–',
  tip: r.contacted ? `${label}: ${r.responded} of ${r.contacted} replied` : `${label}: not contacted yet`,
})

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useRefresh(() => {
    get('dashboard/')
      .then((d) => {
        setData(d)
        setError('')
      })
      .catch((err) => setError(err.message))
  })

  if (error) return <p className="error-text">{error}</p>
  if (!data) return <p className="muted">Loading…</p>

  const { totals } = data

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description="Outreach to Cloud and DevOps companies for SIWES placements and networking."
      />

      <NotificationBanner />

      <section className="stats">
        <Stat label="Companies" value={totals.companies} sub={`${totals.contacted} contacted`} />
        <Stat label="Messages sent" value={totals.messages_sent} />
        <Stat
          label="Response rate"
          value={pct(totals.response_rate)}
          sub={totals.contacted ? `${totals.responded} of ${totals.contacted} replied` : 'Nothing sent yet'}
        />
        <Stat
          label="Follow ups due today"
          value={totals.followups_due_today}
          sub={totals.followups_overdue ? `${totals.followups_overdue} overdue` : 'None overdue'}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="label">Follow ups due</h2>
          <span className="muted small">Created after a week without a reply</span>
        </div>
        {data.due_followups.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Company</th><th>Due</th><th>Draft</th></tr>
              </thead>
              <tbody>
                {data.due_followups.map((f) => (
                  <tr key={f.id} onClick={() => navigate(`/companies/${f.company}`)} tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/companies/${f.company}`)}>
                    <td className="strong">{f.company_name}</td>
                    <td className={f.overdue ? 'text-warn' : ''}>{f.overdue ? `Overdue, ${formatDate(f.due_date)}` : 'Today'}</td>
                    <td className="muted">{f.has_draft ? 'Ready to review' : 'Not drafted'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Nothing due. Follow ups appear here when a company goes quiet.</p>
        )}
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2 className="label">Companies by status</h2>
            <Link to="/pipeline" className="btn">Open pipeline <Icon name="chevron" size={14} /></Link>
          </div>
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

        <section className="panel">
          <div className="panel-head">
            <h2 className="label">Companies contacted per week</h2>
          </div>
          <ColumnChart
            points={data.weekly_volume.map((w) => ({
              key: w.week,
              label: formatDate(w.week).replace(/ \d\d$/, ''),
              value: w.count,
              tip: `Week of ${formatDate(w.week)}: ${w.count} contacted`,
            }))}
          />
          <div className="kv">
            <span className="label">Average days to first reply</span>
            <span>{totals.avg_days_to_first_reply === null ? '–' : totals.avg_days_to_first_reply}</span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="label">Response rate by channel</h2>
          </div>
          <BarList max={1} rows={data.by_channel.map((c) => rateRow(c.channel, c.label, c))} />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="label">Response rate by sector</h2>
          </div>
          <BarList
            max={1}
            stacked
            emptyText="Log a sent message to see results by sector."
            rows={data.by_sector.map((s) => rateRow(s.sector, s.sector, s))}
          />
        </section>
      </div>
    </div>
  )
}
