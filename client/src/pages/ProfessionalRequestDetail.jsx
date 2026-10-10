import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { Field, ErrorBanner, SuccessBanner, Spinner, Badge } from '../components.jsx'
import { formatBRL, parseBRL, formatDate, REQUEST_STATUS, statusBadge } from '../format.jsx'

export default function ProfessionalRequestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [form, setForm] = useState({ price: '', description: '', timeframe: '', conditions: '', valid_until: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api(`/requests/${id}`).then(setData).catch((e) => { setError(e.message); setData({ gone: true }) })
  useEffect(() => { load() }, [id])

  async function submitProposal(e) {
    e.preventDefault()
    setError(''); setSuccess('')
    const cents = parseBRL(form.price)
    if (isNaN(cents) || cents < 100) return setError('Informe um preço válido (mínimo R$ 1,00).')
    if (form.description.trim().length < 20) return setError('Descreva o escopo do serviço com pelo menos 20 caracteres.')
    if (!form.timeframe.trim()) return setError('Informe o prazo estimado.')
    setBusy(true)
    try {
      await api(`/requests/${id}/proposals`, {
        method: 'POST',
        body: { price_cents: cents, description: form.description, timeframe: form.timeframe, conditions: form.conditions, valid_until: form.valid_until },
      })
      setSuccess('Proposta enviada! O cliente será notificado.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function withdraw() {
    if (!window.confirm('Retirar sua proposta?')) return
    try {
      await api(`/proposals/${data.myProposal.id}/withdraw`, { method: 'POST' })
      await load()
    } catch (e) { setError(e.message) }
  }

  if (!data || data.gone) {
    return <div><ErrorBanner message={error || 'Solicitação não encontrada ou não está mais visível.'} /><Link to="/pro">Voltar</Link></div>
  }

  const { request, myProposal } = data
  const open = ['OPEN', 'PROPOSALS_AVAILABLE'].includes(request.status)

  return (
    <>
      <Link to="/pro" className="small">← Voltar ao painel</Link>
      <div className="spread" style={{ marginTop: 8, marginBottom: 4 }}>
        <h1 style={{ fontSize: 24 }}>{request.title}</h1>
        {statusBadge(request.status, REQUEST_STATUS)}
      </div>
      <p className="muted small">
        {request.category_name} · {request.service_type === 'digital' ? 'Serviço digital' : `${request.city}${request.address ? ' — ' + request.address : ''}`}
        {request.preferred_date ? ` · Preferência: ${request.preferred_date}` : ''} · Publicada em {formatDate(request.created_at)}
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="card">
        <h3>Descrição do cliente</h3>
        <p style={{ whiteSpace: 'pre-wrap' }}>{request.description}</p>
        {(request.budget_min != null || request.budget_max != null) && (
          <p className="small muted">Orçamento informado pelo cliente: {request.budget_min != null ? formatBRL(request.budget_min) : '—'} até {request.budget_max != null ? formatBRL(request.budget_max) : '—'}</p>
        )}
      </div>

      <div className="section">
        <h2>Sua proposta</h2>
        {myProposal ? (
          <div className="card">
            <div className="spread">
              <div>
                <span className="proposal-price">{formatBRL(myProposal.price_cents)}</span>
                <p className="small" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{myProposal.description}</p>
                <div className="small muted">
                  {myProposal.timeframe && <div>Prazo: {myProposal.timeframe}</div>}
                  {myProposal.conditions && <div>Condições: {myProposal.conditions}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Badge tone={myProposal.status === 'accepted' ? 'green' : myProposal.status === 'pending' ? 'blue' : 'gray'}>
                  {myProposal.status === 'accepted' ? 'Aceita pelo cliente' : myProposal.status === 'pending' ? 'Aguardando o cliente' : 'Retirada'}
                </Badge>
                {myProposal.status === 'pending' && open && (
                  <div style={{ marginTop: 10 }}>
                    <button className="btn btn-danger btn-sm" onClick={withdraw}>Retirar proposta</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : open ? (
          <form className="card" onSubmit={submitProposal} noValidate>
            <p className="small muted">Você ainda não enviou proposta para esta solicitação. Limite de 3 propostas por solicitação na plataforma.</p>
            <Field label="Preço proposto" hint="Ex.: 850,00"><input inputMode="decimal" placeholder="R$ 0,00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Escopo do serviço" hint="O que está incluído no preço e como o trabalho será feito.">
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={4000} />
            </Field>
            <div className="grid-2">
              <Field label="Prazo estimado" hint="Ex.: 1 dia, 3 dias úteis"><input value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value })} maxLength={120} /></Field>
              <Field label="Válida até (opcional)"><input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></Field>
            </div>
            <Field label="Condições e exclusões (opcional)"><textarea value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} maxLength={2000} style={{ minHeight: 70 }} /></Field>
            <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Enviando…' : 'Enviar proposta'}</button>
          </form>
        ) : (
          <div className="empty-state">
            <h3>Solicitação encerrada para novas propostas</h3>
            <p>Esta solicitação não está mais recebendo propostas.</p>
          </div>
        )}
      </div>
    </>
  )
}
