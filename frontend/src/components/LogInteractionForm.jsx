import { useState } from 'react'
import { post } from '../api'
import { CHANNELS } from '../constants'

function nowLocalInput() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function LogInteractionForm({ companyId, defaultChannel, onLogged, onCancel }) {
  const [form, setForm] = useState({
    direction: 'sent',
    channel: defaultChannel,
    date: nowLocalInput(),
    message: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const created = await post('interactions/', {
        ...form,
        company: companyId,
        date: new Date(form.date).toISOString(),
      })
      onLogged(created)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="log-form stack" onSubmit={submit}>
      <div className="fields">
        <fieldset>
          <legend>Direction</legend>
          <div className="chips">
            {[['sent', 'I sent'], ['received', 'They replied']].map(([value, label]) => (
              <label key={value} className={`chip ${form.direction === value ? 'on' : ''}`}>
                <input type="radio" name="direction" value={value} checked={form.direction === value} onChange={set('direction')} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Channel
          <select value={form.channel} onChange={set('channel')}>
            {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label>
          When
          <input type="datetime-local" value={form.date} onChange={set('date')} required />
        </label>
        <label className="span-2">
          Message
          <textarea rows={4} value={form.message} onChange={set('message')} placeholder="Paste the message" />
        </label>
        <label className="span-2">
          Notes (optional)
          <input value={form.notes} onChange={set('notes')} />
        </label>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Log interaction'}</button>
      </div>
    </form>
  )
}
