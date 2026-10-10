import { Router } from 'express'
import { db, nowISO, notify, audit } from '../db.js'
import { requireAuth, requireRole, rateLimit } from '../auth.js'
import { bad, cleanText } from '../util.js'
import { canTransition } from './requests.js'

const router = Router()

function getJob(id) {
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id)
}

function participant(req, job) {
  return req.user.role === 'admin' || job.client_id === req.user.id || job.professional_id === req.user.id
}

// GET /api/jobs — my jobs (role-scoped)
router.get('/', requireAuth, (req, res) => {
  const col = req.user.role === 'professional' ? 'j.professional_id' : 'j.client_id'
  const jobs = db.prepare(`
    SELECT j.*, r.title, r.service_type, r.city, c.name AS category_name
    FROM jobs j JOIN service_requests r ON r.id = j.request_id
    JOIN service_categories c ON c.id = r.category_id
    WHERE ${col} = ? ORDER BY j.updated_at DESC`).all(req.user.id)
  res.json({ jobs })
})

// GET /api/jobs/:id — participants and admins only
router.get('/:id', requireAuth, (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return bad(res, 'Trabalho não encontrado.', 404)
  if (!participant(req, job)) return bad(res, 'Você não tem permissão para ver este trabalho.', 403)
  const request = db.prepare(`
    SELECT r.*, c.name AS category_name FROM service_requests r
    JOIN service_categories c ON c.id = r.category_id WHERE r.id = ?`).get(job.request_id)
  const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(job.proposal_id)
  const client = db.prepare('SELECT id, name, phone, city FROM users WHERE id = ?').get(job.client_id)
  const professional = db.prepare(`
    SELECT u.id, u.name, u.phone, pp.display_name, pp.verified FROM users u
    JOIN professional_profiles pp ON pp.user_id = u.id WHERE u.id = ?`).get(job.professional_id)
  const review = db.prepare('SELECT * FROM reviews WHERE job_id = ?').get(job.id)
  res.json({ job, request, proposal, client, professional, review })
})

// POST /api/jobs/:id/action — validated job lifecycle
router.post('/:id/action', requireAuth, (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return bad(res, 'Trabalho não encontrado.', 404)
  if (!participant(req, job)) return bad(res, 'Você não tem permissão para alterar este trabalho.', 403)
  const action = req.body.action
  const now = nowISO()
  const isPro = job.professional_id === req.user.id
  const isClient = job.client_id === req.user.id

  const setStatus = (status, requestIdStatus) => {
    const tx = db.transaction(() => {
      db.prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?').run(status, now, job.id)
      if (requestIdStatus) {
        db.prepare('UPDATE service_requests SET status = ?, updated_at = ? WHERE id = ?').run(requestIdStatus, now, job.request_id)
      }
    })
    tx()
  }

  switch (action) {
    case 'schedule': {
      if (!['CONFIRMED', 'SCHEDULED'].includes(job.status)) return bad(res, 'Não é possível agendar neste estágio.', 409)
      const date = cleanText(req.body.scheduled_date, 40)
      if (!date) return bad(res, 'Informe a data agendada.')
      db.prepare('UPDATE jobs SET scheduled_date = ?, updated_at = ? WHERE id = ?').run(date, now, job.id)
      setStatus('SCHEDULED')
      notify(isPro ? job.client_id : job.professional_id, 'job', 'Trabalho agendado',
        'O agendamento deste trabalho foi atualizado.', `/trabalho/${job.id}`)
      break
    }
    case 'start': {
      if (!isPro) return bad(res, 'Apenas o profissional pode iniciar o trabalho.', 403)
      if (!['CONFIRMED', 'SCHEDULED'].includes(job.status)) return bad(res, 'Não é possível iniciar neste estágio.', 409)
      setStatus('IN_PROGRESS', 'IN_PROGRESS')
      notify(job.client_id, 'job', 'Trabalho iniciado', 'O profissional iniciou o trabalho.', `/trabalho/${job.id}`)
      break
    }
    case 'request_completion': {
      if (!isPro) return bad(res, 'Apenas o profissional pode sinalizar a conclusão.', 403)
      if (job.status !== 'IN_PROGRESS') return bad(res, 'O trabalho precisa estar em andamento.', 409)
      setStatus('PENDING_CONFIRMATION')
      notify(job.client_id, 'job', 'Conclusão aguardando sua confirmação',
        'O profissional sinalizou que concluiu o trabalho. Confirme para finalizar.', `/trabalho/${job.id}`)
      break
    }
    case 'confirm': {
      if (!isClient) return bad(res, 'Apenas o cliente pode confirmar a conclusão.', 403)
      if (job.status !== 'PENDING_CONFIRMATION') return bad(res, 'Não há conclusão para confirmar.', 409)
      setStatus('COMPLETED', 'COMPLETED')
      notify(job.professional_id, 'job', 'Trabalho concluído', 'O cliente confirmou a conclusão do trabalho.', `/trabalho/${job.id}`)
      break
    }
    case 'cancel': {
      if (!['CONFIRMED', 'SCHEDULED'].includes(job.status)) return bad(res, 'Este trabalho não pode mais ser cancelado. Registre uma disputa se houver problema.', 409)
      setStatus('CANCELLED', 'CANCELLED')
      notify(isPro ? job.client_id : job.professional_id, 'job', 'Trabalho cancelado',
        `${req.user.name} cancelou o trabalho.`, `/trabalho/${job.id}`)
      audit(req.user.id, 'job.cancelled', `job:${job.id}`, {})
      break
    }
    case 'dispute': {
      if (!['CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_CONFIRMATION'].includes(job.status)) {
        return bad(res, 'Não é possível registrar disputa neste estágio.', 409)
      }
      setStatus('DISPUTED', 'DISPUTED')
      notify(isPro ? job.client_id : job.professional_id, 'job', 'Disputa registrada',
        `${req.user.name} registrou uma disputa neste trabalho. A equipe JOB irá analisar.`, `/trabalho/${job.id}`)
      audit(req.user.id, 'job.disputed', `job:${job.id}`, {})
      break
    }
    default:
      return bad(res, 'Ação desconhecida.')
  }

  res.json({ job: getJob(job.id) })
})

// Admin resolves disputes
router.post('/:id/resolve', requireRole('admin'), (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return bad(res, 'Trabalho não encontrado.', 404)
  if (job.status !== 'DISPUTED') return bad(res, 'Este trabalho não está em disputa.', 409)
  const outcome = req.body.outcome === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED'
  const now = nowISO()
  const tx = db.transaction(() => {
    db.prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?').run(outcome, now, job.id)
    db.prepare('UPDATE service_requests SET status = ?, updated_at = ? WHERE id = ?').run(outcome, now, job.request_id)
  })
  tx()
  audit(req.user.id, 'job.dispute_resolved', `job:${job.id}`, { outcome })
  notify(job.client_id, 'job', 'Disputa resolvida', `A equipe JOB concluiu a disputa como ${outcome === 'COMPLETED' ? 'concluído' : 'cancelado'}.`, `/trabalho/${job.id}`)
  notify(job.professional_id, 'job', 'Disputa resolvida', `A equipe JOB concluiu a disputa como ${outcome === 'COMPLETED' ? 'concluído' : 'cancelado'}.`, `/trabalho/${job.id}`)
  res.json({ job: getJob(job.id) })
})

// Messages — participants + admins; manual refresh (no real-time claim)
router.get('/:id/messages', requireAuth, (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return bad(res, 'Trabalho não encontrado.', 404)
  if (!participant(req, job)) return bad(res, 'Você não tem permissão para ver esta conversa.', 403)
  const messages = db.prepare(`
    SELECT m.id, m.body, m.created_at, m.sender_id, u.name AS sender_name
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.job_id = ? ORDER BY m.created_at ASC LIMIT 200`).all(job.id)
  res.json({ messages })
})

router.post('/:id/messages', requireAuth, rateLimit(30, 60 * 1000), (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return bad(res, 'Trabalho não encontrado.', 404)
  if (!participant(req, job)) return bad(res, 'Você não tem permissão para enviar mensagens aqui.', 403)
  const body = cleanText(req.body.body, 2000)
  if (body.length < 1) return bad(res, 'Escreva uma mensagem.')
  const info = db.prepare('INSERT INTO messages (job_id, sender_id, body, created_at) VALUES (?,?,?,?)')
    .run(job.id, req.user.id, body, nowISO())
  const recipient = req.user.id === job.client_id ? job.professional_id : job.client_id
  notify(recipient, 'message', 'Nova mensagem', `${req.user.name}: ${body.slice(0, 80)}`, `/trabalho/${job.id}`)
  res.json({ message: db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid) })
})

// Review — only after a genuinely COMPLETED job, once, by the client
router.post('/:id/review', requireRole('client'), (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return bad(res, 'Trabalho não encontrado.', 404)
  if (job.client_id !== req.user.id) return bad(res, 'Você não tem permissão para avaliar este trabalho.', 403)
  if (job.status !== 'COMPLETED') return bad(res, 'Só é possível avaliar trabalhos concluídos.', 409)
  if (db.prepare('SELECT id FROM reviews WHERE job_id = ?').get(job.id)) return bad(res, 'Este trabalho já foi avaliado.', 409)
  const rating = Math.round(Number(req.body.rating))
  if (!(rating >= 1 && rating <= 5)) return bad(res, 'Escolha uma nota de 1 a 5.')
  const comment = cleanText(req.body.comment, 2000)
  db.prepare('INSERT INTO reviews (job_id, client_id, professional_id, rating, comment, created_at) VALUES (?,?,?,?,?,?)')
    .run(job.id, req.user.id, job.professional_id, rating, comment, nowISO())
  notify(job.professional_id, 'review', 'Você recebeu uma avaliação', `Nota ${rating}/5 em um trabalho concluído.`, '/pro')
  res.json({ ok: true })
})

// Report a job/participant — feeds the moderation queue
router.post('/:id/report', requireAuth, rateLimit(5, 60 * 60 * 1000), (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return bad(res, 'Trabalho não encontrado.', 404)
  if (!participant(req, job)) return bad(res, 'Você não tem permissão para reportar este trabalho.', 403)
  const reason = cleanText(req.body.reason, 200)
  const details = cleanText(req.body.details, 2000)
  if (!reason) return bad(res, 'Informe o motivo da denúncia.')
  db.prepare('INSERT INTO reports (reporter_id, target_type, target_id, reason, details, created_at) VALUES (?,?,?,?,?,?)')
    .run(req.user.id, 'job', job.id, reason, details, nowISO())
  audit(req.user.id, 'report.created', `job:${job.id}`, { reason })
  res.json({ ok: true })
})

export default router
