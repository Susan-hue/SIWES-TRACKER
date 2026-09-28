import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { del, get, patch, post } from '../api'
import Avatar, { PriorityBadge } from '../components/Avatar.jsx'
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

function Links({ company }) {
  const q = encodeURIComponent(company.name)
  const links = [
    company.website && { href: company.website, label: 'Website', icon: 'globe' },
    company.linkedin
      ? { href: toUrl(company.linkedin, 'https://www.linkedin.com/company/'), label: 'LinkedIn', icon: 'linkedin' }
      : { href: `https://www.linkedin.com/search/results/companies/?keywords=${q}`, label: 'Find on LinkedIn', icon: 'linkedin', find: true },
    company.instagram
      ? { href: toUrl(company.instagram, 'https://www.instagram.com/'), label: 'Instagram', icon: 'instagram' }
      : { href: `https://www.google.com/search?q=${q}+Nigeria+site%3Ainstagram.com`, label: 'Find on Instagram', icon: 'instagram', find: true },
    company.email && { href: `mailto:${company.email}`, label: company.email, icon: 'mail' },
  ].filter(Boolean)
  return (
    <div className="links">
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className={l.find ? 'find' : ''}>
          <Icon name={l.icon} size={15} /> {l.label}
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

  if (!company) {
    return error ? <div className="empty-state error-text">{error}</div> : <div className="skeleton-grid"><div /><div /></div>
  }

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
    <div className="page detail">
      <Link to="/pipeline" className="back"><Icon name="back" size={16} /> Pipeline</Link>

      <header className="profile card">
        <div className="profile-main">
          <Avatar name={company.name} size="lg" />
          <div className="profile-text">
            <h1>{company.name}</h1>
            <div className="profile-meta">
              <span>{company.sector || 'No sector'}</span>
              <PriorityBadge priority={company.priority} />
              {company.channels.map((c) => <span key={c} className="pill">{CHANNEL_LABEL[c]}</span>)}
            </div>
            <div className="muted small"><Icon name="clock" size={13} /> Last contact: {daysAgoLabel(company.days_since_contact)}</div>
          </div>
          <label className={`status-select st-${company.status}`}>
            <span className="dot" />
            <select value={company.status} onChange={(e) => updateStatus(e.target.value)} aria-label="Status">
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>
        {company.fit_rationale && (
          <p className="fit"><Icon name="target" size={16} /> {company.fit_rationale}</p>
        )}
        <Links company={company} />
      </header>

      {error && <p className="error-text">{error}</p>}

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Follow ups</h2>
            <p className="card-sub">
              {config.drafting_enabled
                ? 'AI drafts are suggestions. Edit, send it yourself, then mark it sent.'
                : 'AI drafting is off until LLM_API_KEY is set on the server.'}
            </p>
          </div>
          <button className="btn primary" onClick={draftFollowUp} disabled={drafting}>
            <Icon name="sparkles" /> {drafting ? 'Drafting…' : config.drafting_enabled ? 'Draft follow up' : 'New follow up'}
          </button>
        </div>
        {pending.length === 0 && (
          <div className="empty-state compact">
            <span className="muted small">No follow up waiting.</span>
          </div>
        )}
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
          <div>
            <h2>Conversation</h2>
            <p className="card-sub">Every message you sent and every reply, oldest first</p>
          </div>
          {!logging && <button className="btn" onClick={() => setLogging(true)}><Icon name="plus" /> Log interaction</button>}
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
        {interactions.length === 0 && !logging && (
          <div className="empty-state compact">
            <span className="empty-icon"><Icon name="message" size={20} /></span>
            <strong>No messages yet</strong>
            <span className="muted small">Log the first message you send to start the timeline.</span>
          </div>
        )}
        <ol className="chat">
          {interactions.map((i) => (
            <li key={i.id} className={`bubble-row ${i.direction}`}>
              <div className="bubble">
                <div className="bubble-meta">
                  <Icon name={i.direction === 'sent' ? 'send' : 'reply'} size={13} />
                  <strong>{i.direction === 'sent' ? 'You' : company.name}</strong>
                  <span>· {CHANNEL_LABEL[i.channel]} · {formatDateTime(i.date)}</span>
                </div>
                {i.message ? <p className="bubble-text">{i.message}</p> : <p className="bubble-text muted">(no message text)</p>}
                {i.notes && <p className="bubble-note">{i.notes}</p>}
                <button className="bubble-remove" onClick={() => deleteInteraction(i.id)} aria-label="Remove interaction">
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Details</h2>
          {!editing && (
            <button className="btn" onClick={() => { setEditing(true); setSaveState('') }}>
              <Icon name="edit" /> Edit
            </button>
          )}
          {saveState === 'saved' && !editing && <span className="pill ok">Saved</span>}
        </div>
        {editing ? (
          <form className="stack" onSubmit={saveDetails}>
            <CompanyFields form={form} setForm={setForm} />
            <div className="row end">
              <button type="button" className="btn ghost danger" onClick={deleteCompany}><Icon name="trash" /> Delete company</button>
              <span className="spacer" />
              <button type="button" className="btn ghost" onClick={() => { setEditing(false); setForm({ ...emptyCompany, ...company }) }}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={saveState === 'saving'}>
                {saveState === 'saving' ? 'Saving…' : 'Save changes'}
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
