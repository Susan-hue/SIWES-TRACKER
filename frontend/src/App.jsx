import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import AddCompanyModal from './components/AddCompanyModal.jsx'
import AccessKeyGate from './components/AccessKeyGate.jsx'
import NotificationBanner from './components/NotificationBanner.jsx'
import CompanyDetail from './pages/CompanyDetail.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Pipeline from './pages/Pipeline.jsx'

export default function App() {
  const [adding, setAdding] = useState(false)
  const [needsKey, setNeedsKey] = useState(false)
  // Bumped after a change elsewhere (e.g. a company added) so pages refetch.
  const [version, setVersion] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    const onNeedsKey = () => setNeedsKey(true)
    window.addEventListener('siwes:needs-key', onNeedsKey)
    return () => window.removeEventListener('siwes:needs-key', onNeedsKey)
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">SIWES Outreach</div>
        <nav className="tabs">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/pipeline">Pipeline</NavLink>
        </nav>
        <button className="btn primary add-btn" onClick={() => setAdding(true)}>
          <span aria-hidden="true">+</span> Add company
        </button>
      </header>

      <NotificationBanner />

      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard key={version} />} />
          <Route path="/pipeline" element={<Pipeline key={version} />} />
          <Route path="/companies/:id" element={<CompanyDetail />} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>

      <button className="fab" aria-label="Add company" onClick={() => setAdding(true)}>+</button>

      {adding && (
        <AddCompanyModal
          onClose={() => setAdding(false)}
          onCreated={(company) => {
            setAdding(false)
            setVersion((v) => v + 1)
            navigate(`/companies/${company.id}`)
          }}
        />
      )}
      {needsKey && (
        <AccessKeyGate
          onDone={() => {
            setNeedsKey(false)
            setVersion((v) => v + 1)
          }}
        />
      )}
    </div>
  )
}
