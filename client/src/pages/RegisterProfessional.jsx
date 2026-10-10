import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Field, ErrorBanner } from '../components.jsx'

export default function RegisterProfessional() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '', password: '', consent: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('A senha deve ter pelo menos 8 caracteres.')
    if (!form.consent) return setError('É necessário aceitar os Termos de Uso e a Política de Privacidade.')
    setBusy(true)
    try {
      await api('/auth/register', { method: 'POST', body: { role: 'professional', ...form } })
      await refresh()
      navigate('/pro')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="auth-card card">
      <h1 style={{ fontSize: 24 }}>Criar perfil profissional</h1>
      <p className="muted small">Após o cadastro, complete seu perfil com categorias, áreas de atendimento e descrição para começar a receber solicitações.</p>
      <ErrorBanner message={error} />
      <form onSubmit={submit} noValidate>
        <Field label="Nome profissional ou da empresa"><input value={form.name} onChange={set('name')} required autoFocus /></Field>
        <Field label="E-mail"><input type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label="Telefone (opcional)"><input value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Cidade base (opcional)"><input value={form.city} onChange={set('city')} /></Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres."><input type="password" value={form.password} onChange={set('password')} required /></Field>
        <label className="checkbox-row">
          <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
          <span>Li e aceito os <Link to="/termos">Termos de Uso</Link> e a <Link to="/privacidade">Política de Privacidade</Link>.</span>
        </label>
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? 'Criando perfil…' : 'Criar perfil profissional'}</button>
      </form>
      <p className="auth-switch">Já tem conta? <Link to="/login">Entrar</Link> · É cliente? <Link to="/cadastro/cliente">Criar conta de cliente</Link></p>
    </div>
  )
}
