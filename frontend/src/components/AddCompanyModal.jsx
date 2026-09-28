import { useState } from 'react'
import { post } from '../api'
import { emptyCompany } from '../constants'
import CompanyFields from './CompanyFields.jsx'
import Modal from './Modal.jsx'

export default function AddCompanyModal({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyCompany)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      onCreated(await post('companies/', form))
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Add company" onClose={onClose} wide={expanded}>
      <form className="stack" onSubmit={submit}>
        <CompanyFields form={form} setForm={setForm} full={expanded} autoFocus />
        <button type="button" className="link-btn" onClick={() => setExpanded((x) => !x)}>
          {expanded ? 'Show fewer fields' : 'More details (priority, website, handles…)'}
        </button>
        {error && <p className="error-text">{error}</p>}
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving || !form.name.trim()}>
            {saving ? 'Saving…' : 'Add company'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
