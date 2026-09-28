import { CHANNELS, PRIORITIES, STATUSES } from '../constants'

/** Shared by quick add (full=false: name, sector, channel, fit note) and the full edit form. */
export default function CompanyFields({ form, setForm, full = true, autoFocus = false }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const toggleChannel = (value) =>
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(value) ? f.channels.filter((c) => c !== value) : [...f.channels, value],
    }))

  return (
    <div className="fields">
      <label>
        Name
        <input value={form.name} onChange={set('name')} required autoFocus={autoFocus} />
      </label>
      <label>
        Sector
        <input value={form.sector} onChange={set('sector')} list="sector-options" />
      </label>
      <fieldset className="span-2">
        <legend>Channels</legend>
        <div className="chips">
          {CHANNELS.map((c) => (
            <label key={c.value} className={`chip ${form.channels.includes(c.value) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={form.channels.includes(c.value)}
                onChange={() => toggleChannel(c.value)}
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="span-2">
        {full ? 'Why this company is a fit' : 'One line fit note'}
        {full ? (
          <textarea rows={3} value={form.fit_rationale} onChange={set('fit_rationale')} />
        ) : (
          <input value={form.fit_rationale} onChange={set('fit_rationale')} />
        )}
      </label>
      {full && (
        <>
          <label>
            Priority
            <select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={set('status')}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label>
            Website
            <input value={form.website} onChange={set('website')} placeholder="example.com" />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')} placeholder="careers@example.com" />
          </label>
          <label>
            LinkedIn
            <input value={form.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/company/…" />
          </label>
          <label>
            Instagram
            <input value={form.instagram} onChange={set('instagram')} placeholder="@handle" />
          </label>
        </>
      )}
      <datalist id="sector-options">
        {[
          'Fintech & Payments', 'Cloud & Data Center Infrastructure', 'Software Development & IT Consulting',
          'Cybersecurity', 'SIWES / Training & Placement', 'Telecom', 'E-commerce & Logistics Tech',
        ].map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  )
}
