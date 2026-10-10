import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Field, ErrorBanner } from '../components.jsx'

export default function Login() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const { user } = await api('/auth/login', { method: 'POST', body: form })
      await refresh()
      navigate(user.role === 'professional' ? '/pro' : user.role === 'admin' ? '/admin' : '/painel')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-card card">
      <h1 style={{ fontSize: 24 }}>Entrar</h1>
      <ErrorBanner message={error} />
      <form onSubmit={submit} noValidate>
        <Field label="E-mail">
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoFocus />
        </Field>
        <Field label="Senha">
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="auth-switch">Não tem conta? <Link to="/cadastro/cliente">Sou cliente</Link> · <Link to="/cadastro/profissional">Sou profissional</Link></p>
    </div>
  )
}
