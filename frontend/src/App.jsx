import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import AccessKeyGate from './components/AccessKeyGate.jsx'
import AddCompanyModal from './components/AddCompanyModal.jsx'
import Icon from './components/Icon.jsx'
import NotificationBanner from './components/NotificationBanner.jsx'
import CompanyDetail from './pages/CompanyDetail.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Pipeline from './pages/Pipeline.jsx'

function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <rect x="4" y="12" width="4" height="8" rx="1.2" />
        <rect x="10" y="8" width="4" height="12" rx="1.2" />
        <rect x="16" y="4" width="4" height="16" rx="1.2" />
      </svg>
    </span>
  )
}

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
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <div>
            <div className="brand-name">Outreach</div>
            <div className="brand-sub">SIWES · Cloud &amp; DevOps</div>
          </div>
        </div>
        <button className="btn primary block" onClick={() => setAdding(true)}>
          <Icon name="plus" /> Add company
        </button>
        <nav className="side-nav">
          <NavLink to="/" end><Icon name="dashboard" /> Dashboard</NavLink>
          <NavLink to="/pipeline"><Icon name="pipeline" /> Pipeline</NavLink>
        </nav>
        <div className="side-foot">Drafts are suggestions. Nothing is ever sent for you.</div>
      </aside>

      <header className="mobile-top">
        <div className="brand">
          <Logo />
          <div className="brand-name">Outreach</div>
        </div>
      </header>

      <main className="main">
        <NotificationBanner />
        <Routes>
          <Route path="/" element={<Dashboard key={version} onAdd={() => setAdding(true)} />} />
          <Route path="/pipeline" element={<Pipeline key={version} />} />
          <Route path="/companies/:id" element={<CompanyDetail />} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>

      <nav className="tabbar">
        <NavLink to="/" end><Icon name="dashboard" size={20} /><span>Dashboard</span></NavLink>
        <button className="tab-add" aria-label="Add company" onClick={() => setAdding(true)}>
          <Icon name="plus" size={24} strokeWidth={2.5} />
        </button>
        <NavLink to="/pipeline"><Icon name="pipeline" size={20} /><span>Pipeline</span></NavLink>
      </nav>

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
