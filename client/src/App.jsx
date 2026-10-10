import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import { Layout } from './components.jsx'
import Home from './pages/Home.jsx'
import Buscar from './pages/Buscar.jsx'
import Login from './pages/Login.jsx'
import RegisterClient from './pages/RegisterClient.jsx'
import RegisterProfessional from './pages/RegisterProfessional.jsx'
import ClientDashboard from './pages/ClientDashboard.jsx'
import NewRequest from './pages/NewRequest.jsx'
import RequestDetail from './pages/RequestDetail.jsx'
import ProfessionalDashboard from './pages/ProfessionalDashboard.jsx'
import ProfessionalRequestDetail from './pages/ProfessionalRequestDetail.jsx'
import JobDetail from './pages/JobDetail.jsx'
import Admin from './pages/Admin.jsx'
import Notifications from './pages/Notifications.jsx'
import Legal from './pages/Legal.jsx'
import NotFound from './pages/NotFound.jsx'

function RequireRole({ role, children }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="page loading-state">Carregando…</div>
  if (!user) return <Navigate to="/login" replace />
  if (role !== 'any' && user.role !== role) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { loading, user } = useAuth()
  if (loading) return <div className="loading-state">Carregando…</div>

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/buscar" element={<Buscar />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/cadastro/cliente" element={user ? <Navigate to="/" replace /> : <RegisterClient />} />
        <Route path="/cadastro/profissional" element={user ? <Navigate to="/" replace /> : <RegisterProfessional />} />
        <Route path="/painel" element={<RequireRole role="client"><ClientDashboard /></RequireRole>} />
        <Route path="/painel/solicitacoes/nova" element={<RequireRole role="client"><NewRequest /></RequireRole>} />
        <Route path="/painel/solicitacoes/:id" element={<RequireRole role="client"><RequestDetail /></RequireRole>} />
        <Route path="/pro" element={<RequireRole role="professional"><ProfessionalDashboard /></RequireRole>} />
        <Route path="/pro/solicitacoes/:id" element={<RequireRole role="professional"><ProfessionalRequestDetail /></RequireRole>} />
        <Route path="/trabalho/:id" element={<RequireRole role="any"><JobDetail /></RequireRole>} />
        <Route path="/admin" element={<RequireRole role="admin"><Admin /></RequireRole>} />
        <Route path="/notificacoes" element={<RequireRole role="any"><Notifications /></RequireRole>} />
        <Route path="/termos" element={<Legal page="termos" />} />
        <Route path="/privacidade" element={<Legal page="privacidade" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
