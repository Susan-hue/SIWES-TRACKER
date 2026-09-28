import { useEffect, useState } from 'react'
import { currentPushState, enablePush } from '../push'

const DISMISS_KEY = 'siwes-push-dismissed'

// Browsers only allow the permission prompt from a tap, so the "ask on first
// visit" is this banner rather than an automatic popup.
export default function NotificationBanner() {
  const [state, setState] = useState('checking')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    currentPushState().then(setState).catch(() => setState('unsupported'))
  }, [])

  if (dismissed || state !== 'prompt') return null

  const enable = async () => {
    setBusy(true)
    setError('')
    try {
      await enablePush()
      setState('subscribed')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  return (
    <div className="banner">
      <div>
        <strong>Get reminded when a follow up is due.</strong>
        {error && <div className="error-text">{error}</div>}
      </div>
      <div className="row">
        <button className="btn primary" onClick={enable} disabled={busy}>
          {busy ? 'Enabling…' : 'Turn on notifications'}
        </button>
        <button className="btn ghost" onClick={dismiss}>Not now</button>
      </div>
    </div>
  )
}
