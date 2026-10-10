import React from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'

export function Layout({ children }) {
  const { user, unreadNotifications, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="logo">JOB<span className="logo-dot">.</span></Link>
          <nav className="nav">
            <NavLink to="/" end>Início</NavLink>
            <NavLink to="/buscar">Encontrar profissionais</NavLink>
            {user?.role === 'client' && <NavLink to="/painel" end>Meu painel</NavLink>}
            {user?.role === 'professional' && <NavLink to="/pro" end>Painel profissional</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin">Administração</NavLink>}
          </nav>
          <div className="topbar-actions">
            {user ? (
              <>
                <NavLink to="/notificacoes" className="notif-link">
                  Notificações{unreadNotifications > 0 && <span className="notif-count">{unreadNotifications}</span>}
                </NavLink>
                <span className="user-chip" title={user.email}>{user.name}</span>
                <button className="btn btn-ghost" onClick={handleLogout}>Sair</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">Entrar</Link>
                <Link to="/cadastro/cliente" className="btn btn-primary">Criar conta</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">
        <div className="footer-inner">
          <span>JOB — plataforma de contratação de serviços</span>
          <nav>
            <Link to="/termos">Termos de Uso</Link>
            <Link to="/privacidade">Política de Privacidade (LGPD)</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden>○</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Badge({ tone = 'gray', children }) {
  return <span className={`badge tone-${tone}`}>{children}</span>
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

export function Spinner() {
  return <span className="spinner" aria-label="Carregando" />
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return <div className="error-banner" role="alert">{message}</div>
}

export function SuccessBanner({ message }) {
  if (!message) return null
  return <div className="success-banner" role="status">{message}</div>
}
