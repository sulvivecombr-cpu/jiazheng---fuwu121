import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ErrorBanner, SuccessBanner, Spinner, Badge, Field } from '../components.jsx'
import { formatBRL, formatDateTime, JOB_STATUS, statusBadge } from '../format.jsx'

export default function JobDetail() {
  const { id } = useParams()
  const { me } = useAuth()
  const [data, setData] = useState(null)
  const [messages, setMessages] = useState(null)
  const [msgInput, setMsgInput] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' })
  const [reportReason, setReportReason] = useState('')
  const messagesEnd = useRef(null)

  const load = useCallback(() => {
    api(`/jobs/${id}`).then((d) => { setData(d); setScheduledDate(d.job.scheduled_date || '') }).catch((e) => setError(e.message))
    api(`/jobs/${id}/messages`).then((d) => setMessages(d.messages)).catch(() => setMessages([]))
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { messagesEnd.current?.scrollIntoView({ block: 'end' }) }, [messages])

  async function act(action, extra = {}) {
    setError(''); setSuccess(''); setBusy(true)
    try {
      await api(`/jobs/${id}/action`, { method: 'POST', body: { action, ...extra } })
      setSuccess('Ação registrada.')
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function resolve(outcome) {
    setError(''); setSuccess(''); setBusy(true)
    try {
      await api(`/jobs/${id}/resolve`, { method: 'POST', body: { outcome } })
      setSuccess('Disputa resolvida.')
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    const body = msgInput.trim()
    if (!body) return
    setError(''); setBusy(true)
    try {
      await api(`/jobs/${id}/messages`, { method: 'POST', body: { body } })
      setMsgInput('')
      const d = await api(`/jobs/${id}/messages`)
      setMessages(d.messages)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitReview(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      await api(`/jobs/${id}/review`, { method: 'POST', body: reviewForm })
      setSuccess('Avaliação enviada. Obrigado!')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendReport(e) {
    e.preventDefault()
    if (!reportReason.trim()) return setError('Informe o motivo da denúncia.')
    setError(''); setBusy(true)
    try {
      await api(`/jobs/${id}/report`, { method: 'POST', body: { reason: reportReason, details: '' } })
      setSuccess('Denúncia enviada à equipe JOB.')
      setReportReason('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error && !data) return <div><ErrorBanner message={error} /><Link to="/">Voltar ao início</Link></div>
  if (!data) return <p className="muted">Carregando… <Spinner /></p>

  const { job, request, proposal, client, professional, review } = data
  const isClient = me?.user?.id === job.client_id
  const isPro = me?.user?.id === job.professional_id
  const other = isClient ? professional : client

  return (
    <>
      <Link to={isPro ? '/pro' : '/painel'} className="small">← Voltar</Link>
      <div className="spread" style={{ marginTop: 8, marginBottom: 4 }}>
        <h1 style={{ fontSize: 24 }}>{request.title}</h1>
        {statusBadge(job.status, JOB_STATUS)}
      </div>
      <p className="muted small">
        {request.category_name} · {request.service_type === 'digital' ? 'Serviço digital' : request.city || '—'} ·
        Contratado: {formatBRL(proposal.price_cents)} · {isClient ? `Profissional: ${professional.display_name}` : `Cliente: ${client.name}`}
        {other?.phone ? ` · Telefone: ${other.phone}` : ''}
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div>
          <div className="card">
            <h3>Trabalho</h3>
            <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{proposal.description}</p>
            {proposal.timeframe && <p className="small muted">Prazo acordado: {proposal.timeframe}</p>}
            {proposal.conditions && <p className="small muted">Condições: {proposal.conditions}</p>}
            {job.scheduled_date && <p className="small muted">Agendado para: {job.scheduled_date}</p>}

            <div className="row" style={{ marginTop: 12 }}>
              {['CONFIRMED', 'SCHEDULED'].includes(job.status) && (
                <>
                  <Field label="Data agendada">
                    <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                  </Field>
                  <button className="btn btn-primary btn-sm" disabled={busy || !scheduledDate} onClick={() => act('schedule', { scheduled_date: scheduledDate })}>Agendar</button>
                  <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => { if (window.confirm('Cancelar este trabalho?')) act('cancel') }}>Cancelar</button>
                  {isPro && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act('start')}>Iniciar trabalho</button>}
                </>
              )}
              {job.status === 'IN_PROGRESS' && isPro && (
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act('request_completion')}>Sinalizar conclusão</button>
              )}
              {job.status === 'PENDING_CONFIRMATION' && isClient && (
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act('confirm')}>Confirmar conclusão</button>
              )}
              {!['COMPLETED', 'CANCELLED'].includes(job.status) && (
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { if (window.confirm('Registrar disputa? A equipe JOB irá analisar.')) act('dispute') }}>Registrar disputa</button>
              )}
              {job.status === 'DISPUTED' && me?.user?.role === 'admin' && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => resolve('COMPLETED')} disabled={busy}>Resolver como concluído</button>
                  <button className="btn btn-danger btn-sm" onClick={() => resolve('CANCELLED')} disabled={busy}>Resolver como cancelado</button>
                </>
              )}
            </div>
          </div>

          {isClient && job.status === 'COMPLETED' && (
            <div className="card">
              <h3>Avaliação</h3>
              {review ? (
                <p><Badge tone="amber">{'★'.repeat(review.rating)}</Badge> <span className="small muted">{formatDateTime(review.created_at)}</span>{review.comment && <p className="small">{review.comment}</p>}</p>
              ) : (
                <form onSubmit={submitReview} noValidate>
                  <div className="review-stars" role="radiogroup" aria-label="Nota">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button type="button" key={n} className={n <= reviewForm.rating ? 'on' : ''} onClick={() => setReviewForm({ ...reviewForm, rating: n })} aria-label={`${n} estrelas`}>★</button>
                    ))}
                  </div>
                  <Field label="Comentário (opcional)">
                    <textarea value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} maxLength={2000} style={{ minHeight: 70 }} />
                  </Field>
                  <button className="btn btn-primary btn-sm" disabled={busy || !reviewForm.rating} type="submit">Enviar avaliação</button>
                </form>
              )}
            </div>
          )}

          {!['COMPLETED', 'CANCELLED'].includes(job.status) && (
            <form className="card" onSubmit={sendReport} noValidate>
              <h3>Reportar problema</h3>
              <p className="small muted">Sua denúncia vai para a equipe de moderação do JOB.</p>
              <Field label="Motivo">
                <input value={reportReason} onChange={(e) => setReportReason(e.target.value)} maxLength={200} placeholder="Ex.: profissional não compareceu" />
              </Field>
              <button className="btn btn-danger btn-sm" disabled={busy} type="submit">Enviar denúncia</button>
            </form>
          )}
        </div>

        <div className="card">
          <h3>Mensagens</h3>
          <p className="small muted">Mensagens visíveis apenas para você, {isClient ? 'o profissional contratado' : 'o cliente'} e a equipe JOB. A conversa é atualizada manualmente ou a cada 10 segundos.</p>
          {messages === null ? (
            <p className="muted">Carregando…</p>
          ) : messages.length === 0 ? (
            <p className="muted small">Nenhuma mensagem ainda. Combine os detalhes do trabalho aqui.</p>
          ) : (
            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={`msg ${m.sender_id === me?.user?.id ? 'mine' : 'theirs'}`}>
                  {m.sender_id !== me?.user?.id && <strong className="small">{m.sender_name}</strong>}
                  {m.body}
                  <span className="msg-time">{formatDateTime(m.created_at)}</span>
                </div>
              ))}
              <div ref={messagesEnd} />
            </div>
          )}
          <form className="msg-form" onSubmit={sendMessage}>
            <input placeholder="Escreva uma mensagem…" value={msgInput} onChange={(e) => setMsgInput(e.target.value)} maxLength={2000} />
            <button className="btn btn-primary btn-sm" disabled={busy || !msgInput.trim()} type="submit">Enviar</button>
          </form>
        </div>
      </div>
    </>
  )
}
