import { useState } from 'react'
import { setAccessKey } from '../api'
import Modal from './Modal.jsx'

export default function AccessKeyGate({ onDone }) {
  const [key, setKey] = useState('')
  return (
    <Modal title="Enter your access key" onClose={onDone}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          setAccessKey(key.trim())
          onDone()
        }}
      >
        <p className="muted">
          The server is protected with the ACCESS_KEY you set on Render. Enter it once and this
          device will remember it.
        </p>
        <input
          type="password"
          autoFocus
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Access key"
          autoComplete="current-password"
        />
        <button className="btn primary" type="submit" disabled={!key.trim()}>Save</button>
      </form>
    </Modal>
  )
}
