import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { del, get, patch, post } from '../api'
import { PageHeader, PriorityBadge } from '../components/Badges.jsx'
import CompanyFields from '../components/CompanyFields.jsx'
import FollowUpEditor from '../components/FollowUpEditor.jsx'
import Icon from '../components/Icon.jsx'
import LogInteractionForm from '../components/LogInteractionForm.jsx'
import { CHANNEL_LABEL, STATUSES, daysAgoLabel, emptyCompany, formatDateTime } from '../constants'

const toUrl = (value, base) => {
  if (!value) return ''
  if (/^https?:\/\//.test(value)) return value
  if (value.includes('.')) return `https://${value}`
  return `${base}${value.replace(/^@/, '')}`
}

function companyLinks(company) {
  const q = encodeURIComponent(company.name)
  return [
    company.website && { href: company.website, label: 'Website' },
    company.linkedin
      ? { href: toUrl(company.linkedin, 'https://www.linkedin.com/company/'), label: 'LinkedIn page' }
      : { href: `https://www.linkedin.com/search/results/companies/?keywords=${q}`, label: 'Find on LinkedIn' },
    company.instagram
      ? { href: toUrl(company.instagram, 'https://www.instagram.com/'), label: 'Instagram' }
      : { href: `https://www.google.com/search?q=${q}+Nigeria+site%3Ainstagram.com`, label: 'Find on Instagram' },
    company.email && { href: `mailto:${company.email}`, label: company.email },
  ].filter(Boolean)
}

function preferredChannel(company, interactions) {
  const lastSent = [...interactions].reverse().find((i) => i.direction === 'sent')
  return lastSent?.channel || company.channels[0] || 'linkedin'
}

export default function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [company, setCompany] = useState(null)
  const [form, setForm] = useState(emptyCompany)
  const [interactions, setInteractions] = useState([])
  const [followups, setFollowups] = useState([])
  const [config, setConfig] = useState({ drafting_enabled: false })
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [c, ints, fus, cfg] = await Promise.all([
        get(`companies/${id}/`),
        get(`interactions/?company=${id}`),
        get(`followups/?company=${id}`),
        get('config/'),
      ])
      setCompany(c)
      setForm({ ...emptyCompany, ...c })
      setInteractions(ints)
      setFollowups(fus)
      setConfig(cfg)
    } catch (err) {
      setError(err.message)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (!company) return error ? <p className="error-text">{error}</p> : <p className="muted">Loading…</p>

  const refreshCompany = async () => {
    const c = await get(`companies/${id}/`)
    setCompany(c)
    setForm((f) => ({ ...f, status: c.status }))
  }

  const updateStatus = async (status) => {
    setError('')
    try {
      const c = await patch(`companies/${id}/`, { status })
      setCompany(c)
      setForm((f) => ({ ...f, status: c.status }))
    } catch (err) {
      setError(err.message)
    }
  }

  const saveDetails = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const { name, sector, website, fit_rationale, priority, channels, instagram, linkedin, email, status } = form
      const c = await patch(`companies/${id}/`, { name, sector, website, fit_rationale, priority, channels, instagram, linkedin, email, status })
      setCompany(c)
      setForm({ ...emptyCompany, ...c })
      setEditing(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const draftFollowUp = async () => {
    setDrafting(true)
    setError('')
    try {
      const created = await post(`companies/${id}/draft-followup/`)
      setFollowups((list) => [...list, created])
    } catch (err) {
      setError(err.message)
    } finally {
      setDrafting(false)
    }
  }

  const deleteCompany = async () => {
    if (!window.confirm(`Delete ${company.name} and all its history?`)) return
    try {
      await del(`companies/${id}/`)
      navigate('/pipeline')
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteInteraction = async (interactionId) => {
    try {
      await del(`interactions/${interactionId}/`)
      setInteractions((list) => list.filter((i) => i.id !== interactionId))
    } catch (err) {
      setError(err.message)
    }
  }

  const pending = followups.filter((f) => !f.sent)
  const channel = preferredChannel(company, interactions)

  return (
    <div className="page narrow">
      <Link to="/pipeline" className="back"><Icon name="back" size={14} /> Pipeline</Link>

      <PageHeader
        eyebrow={company.sector || 'Company'}
        title={company.name}
        actions={
          <label className="filter">
            <span className="label">Status</span>
            <select value={company.status} onChange={(e) => updateStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        }
      />

      {error && <p className="error-text">{error}</p>}

      <section className="panel">
        <div className="facts">
          <div><div className="label">Priority</div><PriorityBadge priority={company.priority} /></div>
          <div><div className="label">Last contact</div>{daysAgoLabel(company.days_since_contact)}</div>
          <div><div className="label">Messages logged</div>{interactions.length}</div>
          <div><div className="label">Added</div>{formatDateTime(company.created_at).split(',')[0]}</div>
        </div>

        <div className="link-list">
          {companyLinks(company).map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
              <Icon name="external" size={13} /> {l.label}
            </a>
          ))}
        </div>

        {company.fit_rationale && (
          <div className="section">
            <div className="label">Why it fits</div>
            <p>{company.fit_rationale}</p>
          </div>
        )}

        <div className="section">
          <div className="label">Channels</div>
          <div className="tags">
            {company.channels.length
              ? company.channels.map((c) => <span key={c} className="tag">{CHANNEL_LABEL[c]}</span>)
              : <span className="muted">None set</span>}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="label">Follow up</h2>
          <button className="btn" onClick={draftFollowUp} disabled={drafting}>
            <Icon name="sparkles" size={14} />
            {drafting ? 'Drafting…' : config.drafting_enabled ? 'Draft follow up' : 'New follow up'}
          </button>
        </div>
        {!config.drafting_enabled && (
          <p className="muted small">AI drafting is off until LLM_API_KEY is set on the server.</p>
        )}
        {pending.length === 0 && <p className="empty">No follow up waiting.</p>}
        {pending.map((f) => (
          <FollowUpEditor
            key={f.id}
            followup={f}
            defaultChannel={channel}
            draftingEnabled={config.drafting_enabled}
            onChange={(updated, logged) => {
              setFollowups((list) => list.map((x) => (x.id === updated.id ? updated : x)))
              if (logged) {
                get(`interactions/?company=${id}`).then(setInteractions)
                refreshCompany()
              }
            }}
            onRemoved={(fid) => setFollowups((list) => list.filter((x) => x.id !== fid))}
          />
        ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="label">Interaction timeline</h2>
          {!logging && <button className="btn" onClick={() => setLogging(true)}><Icon name="plus" size={14} /> Log interaction</button>}
        </div>
        {logging && (
          <LogInteractionForm
            companyId={company.id}
            defaultChannel={channel}
            onCancel={() => setLogging(false)}
            onLogged={(created) => {
              setInteractions((list) => [...list, created].sort((a, b) => a.date.localeCompare(b.date)))
              setLogging(false)
              refreshCompany()
            }}
          />
        )}
        {interactions.length === 0 && !logging && <p className="empty">Nothing logged yet. Log the first message you send.</p>}
        <ol className="timeline">
          {interactions.map((i) => (
            <li key={i.id} className={i.direction}>
              <div className="timeline-meta">
                <span className="label">{i.direction === 'sent' ? 'Sent' : 'Received'} · {CHANNEL_LABEL[i.channel]}</span>
                <span className="muted small">{formatDateTime(i.date)}</span>
                <button className="text-btn" onClick={() => deleteInteraction(i.id)}>Remove</button>
              </div>
              {i.message && <p className="timeline-text">{i.message}</p>}
              {i.notes && <p className="muted small">{i.notes}</p>}
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="label">Company details</h2>
          {!editing && <button className="btn" onClick={() => setEditing(true)}><Icon name="edit" size={14} /> Edit</button>}
        </div>
        {editing ? (
          <form className="stack" onSubmit={saveDetails}>
            <CompanyFields form={form} setForm={setForm} />
            <div className="action-bar">
              <button type="button" className="btn danger-outline" onClick={deleteCompany}>Delete company</button>
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => { setEditing(false); setForm({ ...emptyCompany, ...company }) }}>
                Cancel
              </button>
              <button type="submit" className="btn primary">Save changes</button>
            </div>
          </form>
        ) : (
          <div className="facts">
            <div><div className="label">Website</div>{company.website || '–'}</div>
            <div><div className="label">Email</div>{company.email || '–'}</div>
            <div><div className="label">LinkedIn</div>{company.linkedin || '–'}</div>
            <div><div className="label">Instagram</div>{company.instagram || '–'}</div>
          </div>
        )}
      </section>
    </div>
  )
}
