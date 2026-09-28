import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import AccessKeyGate from './components/AccessKeyGate.jsx'
import AddCompanyModal from './components/AddCompanyModal.jsx'
import Icon from './components/Icon.jsx'
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
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="wordmark">SIWES Outreach</span>
          <nav className="topnav">
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/pipeline">Pipeline</NavLink>
          </nav>
          <button className="btn primary add-desktop" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> Add company
          </button>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard key={version} />} />
          <Route path="/pipeline" element={<Pipeline key={version} />} />
          <Route path="/companies/:id" element={<CompanyDetail />} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>

      <nav className="tabbar">
        <NavLink to="/" end><Icon name="dashboard" size={19} /><span>Dashboard</span></NavLink>
        <button className="tab-add" onClick={() => setAdding(true)}>
          <Icon name="plus" size={19} /><span>Add</span>
        </button>
        <NavLink to="/pipeline"><Icon name="pipeline" size={19} /><span>Pipeline</span></NavLink>
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
