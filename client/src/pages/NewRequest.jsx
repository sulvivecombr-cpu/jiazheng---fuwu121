import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Field, ErrorBanner } from '../components.jsx'
import { parseBRL } from '../format.jsx'

export default function NewRequest() {
  const navigate = useNavigate()
  const { me } = useAuth()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    category_id: '', title: '', description: '', service_type: 'local',
    city: me?.user?.city || '', address: '', preferred_date: '', budget_min: '', budget_max: '',
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => { api('/categories').then((d) => setCategories(d.categories)).catch(() => {}) }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  function validate() {
    const fe = {}
    if (!form.category_id) fe.category = 'Selecione uma categoria.'
    if (form.title.trim().length < 5) fe.title = 'O título deve ter pelo menos 5 caracteres.'
    if (form.description.trim().length < 20) fe.description = 'Descreva o serviço com pelo menos 20 caracteres.'
    if (form.service_type === 'local' && !form.city.trim()) fe.city = 'Informe a cidade para serviços presenciais.'
    if (form.budget_min && isNaN(parseBRL(form.budget_min))) fe.budget_min = 'Valor inválido.'
    if (form.budget_max && isNaN(parseBRL(form.budget_max))) fe.budget_max = 'Valor inválido.'
    if (form.budget_min && form.budget_max && parseBRL(form.budget_min) > parseBRL(form.budget_max)) fe.budget_max = 'Máximo deve ser maior que o mínimo.'
    setFieldErrors(fe)
    return Object.keys(fe).length === 0
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setBusy(true)
    try {
      const { request } = await api('/requests', {
        method: 'POST',
        body: {
          ...form,
          category_id: Number(form.category_id),
          budget_min: form.budget_min ? parseBRL(form.budget_min) : null,
          budget_max: form.budget_max ? parseBRL(form.budget_max) : null,
        },
      })
      navigate(`/painel/solicitacoes/${request.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="form-panel">
      <h1 className="page-title" style={{ fontSize: 24 }}>Nova solicitação de serviço</h1>
      <p className="muted small">Profissionais compatíveis com sua necessidade receberão esta solicitação e poderão enviar propostas (até 3).</p>
      <ErrorBanner message={error} />
      <form onSubmit={submit} noValidate className="card">
        <Field label="Categoria" error={fieldErrors.category}>
          <select value={form.category_id} onChange={set('category_id')} required>
            <option value="">Selecione…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Título" error={fieldErrors.title} hint="Ex.: Limpeza pós-obra em apartamento de 2 quartos">
          <input value={form.title} onChange={set('title')} maxLength={120} required />
        </Field>
        <Field label="Descrição do serviço" error={fieldErrors.description} hint="Explique o que precisa, detalhes importantes e condições de acesso.">
          <textarea value={form.description} onChange={set('description')} maxLength={4000} required />
        </Field>
        <Field label="Tipo de serviço">
          <select value={form.service_type} onChange={set('service_type')}>
            <option value="local">Presencial (no local)</option>
            <option value="digital">Digital / remoto</option>
          </select>
        </Field>
        {form.service_type === 'local' && (
          <div className="grid-2">
            <Field label="Cidade" error={fieldErrors.city}><input value={form.city} onChange={set('city')} /></Field>
            <Field label="Endereço / bairro (opcional)"><input value={form.address} onChange={set('address')} /></Field>
          </div>
        )}
        <Field label="Data preferida (opcional)">
          <input type="date" value={form.preferred_date} onChange={set('preferred_date')} />
        </Field>
        <div className="grid-2">
          <Field label="Orçamento mínimo (opcional)" error={fieldErrors.budget_min} hint="Ex.: 500,00">
            <input inputMode="decimal" placeholder="R$ 0,00" value={form.budget_min} onChange={set('budget_min')} />
          </Field>
          <Field label="Orçamento máximo (opcional)" error={fieldErrors.budget_max}>
            <input inputMode="decimal" placeholder="R$ 0,00" value={form.budget_max} onChange={set('budget_max')} />
          </Field>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? 'Enviando…' : 'Publicar solicitação'}</button>
      </form>
    </div>
  )
}
