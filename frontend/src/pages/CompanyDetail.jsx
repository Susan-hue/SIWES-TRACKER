import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { del, get, patch, post } from '../api'
import CompanyFields from '../components/CompanyFields.jsx'
import FollowUpEditor from '../components/FollowUpEditor.jsx'
import LogInteractionForm from '../components/LogInteractionForm.jsx'
import { CHANNEL_LABEL, PRIORITY_LABEL, STATUSES, daysAgoLabel, emptyCompany, formatDateTime } from '../constants'

const toUrl = (value, base) => {
  if (!value) return ''
  if (/^https?:\/\//.test(value)) return value
  if (value.includes('.')) return `https://${value}`
  return `${base}${value.replace(/^@/, '')}`
}

function Links({ company }) {
  const q = encodeURIComponent(company.name)
  const links = [
    company.website && { href: company.website, label: 'Website' },
    company.linkedin
      ? { href: toUrl(company.linkedin, 'https://www.linkedin.com/company/'), label: 'LinkedIn' }
      : { href: `https://www.linkedin.com/search/results/companies/?keywords=${q}`, label: 'Find on LinkedIn', find: true },
    company.instagram
      ? { href: toUrl(company.instagram, 'https://www.instagram.com/'), label: 'Instagram' }
      : { href: `https://www.google.com/search?q=${q}+Nigeria+site%3Ainstagram.com`, label: 'Find on Instagram', find: true },
    company.email && { href: `mailto:${company.email}`, label: company.email },
  ].filter(Boolean)
  return (
    <div className="links">
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className={l.find ? 'find' : ''}>
          {l.label}
        </a>
      ))}
    </div>
  )
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
  const [saveState, setSaveState] = useState('')

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
    setSaveState('saving')
    setError('')
    try {
      const { name, sector, website, fit_rationale, priority, channels, instagram, linkedin, email, status } = form
      const c = await patch(`companies/${id}/`, { name, sector, website, fit_rationale, priority, channels, instagram, linkedin, email, status })
      setCompany(c)
      setForm({ ...emptyCompany, ...c })
      setSaveState('saved')
      setEditing(false)
    } catch (err) {
      setError(err.message)
      setSaveState('')
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
    <div className="detail">
      <Link to="/pipeline" className="back">← Pipeline</Link>

      <header className="detail-head">
        <div>
          <h1>{company.name}</h1>
          <div className="muted">
            {company.sector || 'No sector'} · {PRIORITY_LABEL[company.priority]} priority ·{' '}
            {company.channels.map((c) => CHANNEL_LABEL[c]).join(', ') || 'No channel set'}
          </div>
          <div className="muted small">Last contact: {daysAgoLabel(company.days_since_contact)}</div>
        </div>
        <label className="status-select">
          Status
          <select value={company.status} onChange={(e) => updateStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </header>

      <Links company={company} />
      {company.fit_rationale && <p className="fit">{company.fit_rationale}</p>}
      {error && <p className="error-text">{error}</p>}

      <section className="card">
        <div className="card-head">
          <h2>Follow ups</h2>
          <button className="btn primary" onClick={draftFollowUp} disabled={drafting}>
            {drafting ? 'Drafting…' : config.drafting_enabled ? 'Draft follow up' : 'New follow up'}
          </button>
        </div>
        {!config.drafting_enabled && (
          <p className="muted small">AI drafting is off until LLM_API_KEY is set on the server. You can still write follow ups yourself.</p>
        )}
        {pending.length === 0 && <p className="muted small">No follow up waiting.</p>}
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

      <section className="card">
        <div className="card-head">
          <h2>Timeline</h2>
          {!logging && <button className="btn" onClick={() => setLogging(true)}>Log interaction</button>}
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
        {interactions.length === 0 && !logging && <p className="muted small">Nothing logged yet.</p>}
        <ol className="timeline">
          {interactions.map((i) => (
            <li key={i.id} className={`tl-item ${i.direction}`}>
              <div className="tl-meta">
                <strong>{i.direction === 'sent' ? 'You sent' : 'They replied'}</strong>
                <span className="muted small">via {CHANNEL_LABEL[i.channel]} · {formatDateTime(i.date)}</span>
                <button className="link-btn small danger" onClick={() => deleteInteraction(i.id)}>Remove</button>
              </div>
              {i.message && <p className="tl-message">{i.message}</p>}
              {i.notes && <p className="muted small">{i.notes}</p>}
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Details</h2>
          {!editing && <button className="btn" onClick={() => { setEditing(true); setSaveState('') }}>Edit</button>}
          {saveState === 'saved' && !editing && <span className="muted small">Saved</span>}
        </div>
        {editing ? (
          <form className="stack" onSubmit={saveDetails}>
            <CompanyFields form={form} setForm={setForm} />
            <div className="row end">
              <button type="button" className="btn ghost danger" onClick={deleteCompany}>Delete company</button>
              <span className="spacer" />
              <button type="button" className="btn ghost" onClick={() => { setEditing(false); setForm({ ...emptyCompany, ...company }) }}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={saveState === 'saving'}>
                {saveState === 'saving' ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="facts">
            <dt>Website</dt><dd>{company.website || '–'}</dd>
            <dt>Email</dt><dd>{company.email || '–'}</dd>
            <dt>LinkedIn</dt><dd>{company.linkedin || '–'}</dd>
            <dt>Instagram</dt><dd>{company.instagram || '–'}</dd>
            <dt>Added</dt><dd>{formatDateTime(company.created_at)}</dd>
          </dl>
        )}
      </section>
    </div>
  )
}
