import { useState } from 'react'
import { del, patch, post } from '../api'
import { CHANNELS, formatDate } from '../constants'
import Icon from './Icon.jsx'

/** An editable draft. Nothing is sent from here: "Mark as sent" only records
 *  that you sent it yourself (and logs it on the timeline). */
export default function FollowUpEditor({ followup, defaultChannel, draftingEnabled, onChange, onRemoved }) {
  const [text, setText] = useState(followup.drafted_message)
  const [channel, setChannel] = useState(defaultChannel)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(followup.draft_error || '')
  const [copied, setCopied] = useState(false)
  const dirty = text !== followup.drafted_message

  const run = async (label, fn) => {
    setBusy(label)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const save = () => run('save', async () => onChange(await patch(`followups/${followup.id}/`, { drafted_message: text })))

  const regenerate = () =>
    run('regenerate', async () => {
      const updated = await post(`followups/${followup.id}/regenerate/`)
      setText(updated.drafted_message)
      onChange(updated)
    })

  const markSent = () =>
    run('sent', async () => onChange(await post(`followups/${followup.id}/mark-sent/`, { message: text, channel }), true))

  const remove = () => run('delete', async () => {
    await del(`followups/${followup.id}/`)
    onRemoved(followup.id)
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Copy failed, select the text and copy it manually.')
    }
  }

  return (
    <div className="followup">
      <div className="followup-head">
        <span className="followup-icon"><Icon name="sparkles" size={15} /></span>
        <strong>Follow up due {formatDate(followup.due_date)}</strong>
        {followup.auto_created && <span className="pill info">Auto created</span>}
      </div>
      <textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={draftingEnabled ? 'Write your follow up, or generate a draft.' : 'Write your follow up here.'}
      />
      {error && <p className="error-text">{error}</p>}
      <div className="row wrap">
        <button className="btn" onClick={copy} disabled={!text}><Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? 'Copied' : 'Copy'}</button>
        <button className="btn" onClick={save} disabled={!dirty || !!busy}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
        {draftingEnabled && (
          <button className="btn" onClick={regenerate} disabled={!!busy}>
            <Icon name="sparkles" size={15} /> {busy === 'regenerate' ? 'Drafting…' : text ? 'Redraft' : 'Generate draft'}
          </button>
        )}
        <span className="spacer" />
        <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel you sent it on">
          {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button className="btn primary" onClick={markSent} disabled={!text.trim() || !!busy}>
          <Icon name="check" size={15} /> {busy === 'sent' ? 'Saving…' : 'I sent this'}
        </button>
        <button className="btn ghost danger" onClick={remove} disabled={!!busy} aria-label="Delete follow up">
          <Icon name="trash" size={15} />
        </button>
      </div>
    </div>
  )
}
