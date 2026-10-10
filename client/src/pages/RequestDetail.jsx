import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import { Badge, ErrorBanner, Spinner } from '../components.jsx'
import { formatBRL, formatDate, formatDateTime, REQUEST_STATUS, statusBadge } from '../format.jsx'

const TIMELINE = ['OPEN', 'PROPOSALS_AVAILABLE', 'PROFESSIONAL_SELECTED', 'IN_PROGRESS', 'COMPLETED']

export default function RequestDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [proposals, setProposals] = useState(null)
  const [error, setError] = useState('')
  const [busyProposal, setBusyProposal] = useState(null)

  const load = () => {
    api(`/requests/${id}`).then(setData).catch((e) => setError(e.message))
    api(`/requests/${id}/proposals`).then((d) => setProposals(d.proposals)).catch(() => setProposals([]))
  }
  useEffect(() => { load() }, [id])

  async function accept(proposalId) {
    if (!window.confirm('Escolher este profissional? As demais propostas ficarão sem efeito.')) return
    setBusyProposal(proposalId)
    setError('')
    try {
      const { jobId } = await api(`/proposals/${proposalId}/accept`, { method: 'POST' })
      window.location.href = `/trabalho/${jobId}`
    } catch (e) {
      setError(e.message)
      setBusyProposal(null)
      load()
    }
  }

  async function act(action) {
    setError('')
    try {
      await api(`/requests/${id}/action`, { method: 'POST', body: { action } })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (error && !data) {
    return <div><ErrorBanner message={error} /><Link to="/painel">Voltar ao painel</Link></div>
  }
  if (!data) return <p className="muted">Carregando… <Spinner /></p>

  const { request, job, proposalCount } = data
  const timelineIndex = TIMELINE.indexOf(request.status === 'CANCELLED' || request.status === 'DISPUTED' ? '' : request.status)

  return (
    <>
      <Link to="/painel" className="small">← Voltar ao painel</Link>
      <div className="spread" style={{ marginTop: 8, marginBottom: 4 }}>
        <h1 style={{ fontSize: 24 }}>{request.title}</h1>
        {statusBadge(request.status, REQUEST_STATUS)}
      </div>
      <p className="muted small">
        {request.category_name} · {request.service_type === 'digital' ? 'Serviço digital' : `${request.city}${request.address ? ' — ' + request.address : ''}`}
        {request.preferred_date ? ` · Preferência: ${request.preferred_date}` : ''} · Criada em {formatDate(request.created_at)}
      </p>

      <ErrorBanner message={error} />

      <div className="card">
        <h3>Descrição</h3>
        <p style={{ whiteSpace: 'pre-wrap' }}>{request.description}</p>
        {(request.budget_min != null || request.budget_max != null) && (
          <p className="small muted">Orçamento informado: {request.budget_min != null ? formatBRL(request.budget_min) : '—'} até {request.budget_max != null ? formatBRL(request.budget_max) : '—'}</p>
        )}
      </div>

      <div className="card">
        <h3>Situação</h3>
        <ul className="timeline">
          {TIMELINE.map((s, i) => (
            <li key={s} className={i <= timelineIndex ? 'done' : ''}>{REQUEST_STATUS[s].label}</li>
          ))}
        </ul>
        <div className="row" style={{ marginTop: 10 }}>
          {job && <Link to={`/trabalho/${job.id}`} className="btn btn-primary btn-sm">Ir para o trabalho</Link>}
          {['OPEN', 'PROPOSALS_AVAILABLE'].includes(request.status) && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => act('close_receiving')}>Encerrar recebimento de propostas</button>
              <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Cancelar esta solicitação?')) act('cancel') }}>Cancelar solicitação</button>
            </>
          )}
          {request.status === 'PROFESSIONAL_SELECTED' && job && ['CONFIRMED', 'SCHEDULED'].includes(job.status) && (
            <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Cancelar? O profissional será avisado.')) act('cancel') }}>Cancelar trabalho</button>
          )}
        </div>
      </div>

      <div className="section">
        <h2>Propostas recebidas ({proposalCount})</h2>
        {proposals === null ? (
          <p className="muted">Carregando…</p>
        ) : proposals.length === 0 ? (
          <div className="empty-state">
            <h3>Ainda sem propostas</h3>
            <p>Profissionais compatíveis com esta solicitação ainda não responderam. Isso pode levar algum tempo — você será notificado quando uma proposta chegar.</p>
          </div>
        ) : (
          proposals.map((p) => (
            <div key={p.id} className="proposal-card">
              <div className="spread">
                <div>
                  <span className="proposal-price">{formatBRL(p.price_cents)}</span>
                  <div className="small muted">
                    <strong>{p.display_name}</strong> {p.verified && <span className="verified-mark">✓ Verificado</span>}
                    {p.rating && <Badge tone="amber">★ {p.rating.avg.toFixed(1)} ({p.rating.count})</Badge>}
                  </div>
                </div>
                <div>
                  {p.status === 'accepted' && <Badge tone="green">Selecionada</Badge>}
                  {p.status === 'not_selected' && <Badge tone="gray">Não selecionada</Badge>}
                  {p.status === 'withdrawn' && <Badge tone="gray">Retirada</Badge>}
                  {p.status === 'pending' && request.status !== 'PROFESSIONAL_SELECTED' && (
                    <button className="btn btn-primary btn-sm" disabled={busyProposal === p.id} onClick={() => accept(p.id)}>
                      {busyProposal === p.id ? 'Selecionando…' : 'Escolher este profissional'}
                    </button>
                  )}
                </div>
              </div>
              <p className="small" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{p.description}</p>
              <div className="small muted">
                {p.timeframe && <div>Prazo: {p.timeframe}</div>}
                {p.conditions && <div>Condições: {p.conditions}</div>}
                {p.valid_until && <div>Válida até: {p.valid_until}</div>}
                <div>Enviada em {formatDateTime(p.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
