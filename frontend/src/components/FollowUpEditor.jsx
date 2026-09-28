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
      <div className="facts compact">
        <div><div className="label">Due</div>{formatDate(followup.due_date)}</div>
        <div><div className="label">Created</div>{followup.auto_created ? 'Automatically' : 'By you'}</div>
        <div>
          <div className="label">Send via</div>
          <select className="inline-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className="label">Message draft</div>
      <textarea
        className="mono-box"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={draftingEnabled ? 'Write your follow up, or generate a draft.' : 'Write your follow up here.'}
      />
      {error && <p className="error-text">{error}</p>}

      <div className="action-bar">
        <button className="btn danger-outline" onClick={remove} disabled={!!busy}>Discard</button>
        <span className="spacer" />
        <button className="btn" onClick={copy} disabled={!text}>
          <Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied' : 'Copy'}
        </button>
        {dirty && (
          <button className="btn" onClick={save} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
        )}
        {draftingEnabled && (
          <button className="btn" onClick={regenerate} disabled={!!busy}>
            {busy === 'regenerate' ? 'Drafting…' : text ? 'Redraft' : 'Generate draft'}
          </button>
        )}
        <button className="btn primary" onClick={markSent} disabled={!text.trim() || !!busy}>
          <Icon name="send" size={14} /> {busy === 'sent' ? 'Saving…' : 'Mark as sent'}
        </button>
      </div>
    </div>
  )
}
