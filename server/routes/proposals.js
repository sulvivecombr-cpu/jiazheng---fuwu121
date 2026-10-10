import { Router } from 'express'
import { db, nowISO, notify, audit } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { bad, cleanText } from '../util.js'
import { eligibleProfessionalsFor } from '../matching.js'

const router = Router()
const MAX_PROPOSALS_PER_REQUEST = 3

// POST /api/requests/:id/proposals — professionals submit a proposal
router.post('/requests/:id/proposals', requireRole('professional'), (req, res) => {
  const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(req.params.id)
  if (!request) return bad(res, 'Solicitação não encontrada.', 404)
  if (!['OPEN', 'PROPOSALS_AVAILABLE'].includes(request.status)) {
    return bad(res, 'Esta solicitação não está mais recebendo propostas.', 409)
  }
  if (request.client_id === req.user.id) return bad(res, 'Você não pode propor no seu próprio pedido.', 403)

  // Eligibility: category + coverage/remote, same rules as matching.
  if (!eligibleProfessionalsFor(request).some((m) => m.user_id === req.user.id)) {
    return bad(res, 'Você não atende aos requisitos desta solicitação (categoria ou região).', 403)
  }

  if (db.prepare('SELECT id FROM proposals WHERE request_id = ? AND professional_id = ?').get(request.id, req.user.id)) {
    return bad(res, 'Você já enviou uma proposta para esta solicitação.', 409)
  }
  const count = db.prepare(`SELECT COUNT(*) AS c FROM proposals WHERE request_id = ? AND status IN ('pending','accepted')`).get(request.id).c
  if (count >= MAX_PROPOSALS_PER_REQUEST) {
    return bad(res, 'Esta solicitação já atingiu o limite de 3 propostas.', 409)
  }

  const priceCents = Math.round(Number(req.body.price_cents))
  const description = cleanText(req.body.description, 4000)
  const timeframe = cleanText(req.body.timeframe, 120)
  const conditions = cleanText(req.body.conditions, 2000)
  const validUntil = cleanText(req.body.valid_until, 40)

  if (isNaN(priceCents) || priceCents < 100) return bad(res, 'Informe um preço válido (mínimo R$ 1,00).')
  if (description.length < 20) return bad(res, 'Descreva o escopo do serviço com pelo menos 20 caracteres.')
  if (!timeframe) return bad(res, 'Informe o prazo estimado para conclusão.')

  const info = db.prepare(`INSERT INTO proposals
    (request_id, professional_id, price_cents, description, timeframe, conditions, valid_until, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(request.id, req.user.id, priceCents, description, timeframe, conditions, validUntil, 'pending', nowISO())

  const newCount = count + 1
  if (newCount >= MAX_PROPOSALS_PER_REQUEST && request.status === 'OPEN') {
    db.prepare(`UPDATE service_requests SET status = 'PROPOSALS_AVAILABLE', updated_at = ? WHERE id = ?`).run(nowISO(), request.id)
  }
  notify(request.client_id, 'proposal', 'Nova proposta recebida',
    `${req.user.name} enviou uma proposta para "${request.title}".`, `/painel/solicitacoes/${request.id}`)

  res.json({ proposal: db.prepare('SELECT * FROM proposals WHERE id = ?').get(info.lastInsertRowid) })
})

// GET /api/requests/:id/proposals — owner sees all, professionals see only their own
router.get('/requests/:id/proposals', requireAuth, (req, res) => {
  const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(req.params.id)
  if (!request) return bad(res, 'Solicitação não encontrada.', 404)
  const isOwner = request.client_id === req.user.id || req.user.role === 'admin'

  const rows = db.prepare(`
    SELECT p.*, u.name AS professional_name, pp.display_name, pp.verified
    FROM proposals p JOIN users u ON u.id = p.professional_id
    JOIN professional_profiles pp ON pp.user_id = p.professional_id
    WHERE p.request_id = ? ORDER BY p.created_at ASC`).all(request.id)

  const visible = isOwner ? rows : rows.filter((r) => r.professional_id === req.user.id)
  const withRating = visible.map((p) => {
    const r = db.prepare('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE professional_id = ?').get(p.professional_id)
    return { ...p, rating: r.n > 0 ? { avg: Math.round(r.avg * 10) / 10, count: r.n } : null }
  })
  res.json({ proposals: withRating })
})

// POST /api/proposals/:id/accept — transactional selection
router.post('/proposals/:id/accept', requireRole('client'), (req, res) => {
  const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id)
  if (!proposal) return bad(res, 'Proposta não encontrada.', 404)
  const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(proposal.request_id)
  if (request.client_id !== req.user.id) return bad(res, 'Você não tem permissão para aceitar esta proposta.', 403)
  if (!['OPEN', 'PROPOSALS_AVAILABLE'].includes(request.status)) {
    return bad(res, 'Esta solicitação já tem um profissional escolhido ou foi encerrada.', 409)
  }
  if (proposal.status !== 'pending') return bad(res, 'Esta proposta não está mais disponível.', 409)
  const now = nowISO()

  let jobId
  const tx = db.transaction(() => {
    db.prepare(`UPDATE proposals SET status = 'accepted' WHERE id = ?`).run(proposal.id)
    db.prepare(`UPDATE proposals SET status = 'not_selected' WHERE request_id = ? AND id <> ? AND status = 'pending'`)
      .run(request.id, proposal.id)
    db.prepare(`UPDATE service_requests SET status = 'PROFESSIONAL_SELECTED', updated_at = ? WHERE id = ?`).run(now, request.id)
    jobId = db.prepare(`INSERT INTO jobs (request_id, proposal_id, client_id, professional_id, status, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?)`)
      .run(request.id, proposal.id, req.user.id, proposal.professional_id, 'CONFIRMED', now, now).lastInsertRowid
  })
  tx()

  notify(proposal.professional_id, 'job', 'Sua proposta foi aceita!',
    `A proposta para "${request.title}" foi aceita. Acesse o trabalho para combinar os detalhes.`, `/trabalho/${jobId}`)
  audit(req.user.id, 'proposal.accepted', `proposal:${proposal.id}`, { request_id: request.id, job_id: jobId })

  res.json({ jobId })
})

// POST /api/proposals/:id/withdraw — professional withdraws own pending proposal
router.post('/proposals/:id/withdraw', requireRole('professional'), (req, res) => {
  const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id)
  if (!proposal || proposal.professional_id !== req.user.id) return bad(res, 'Proposta não encontrada.', 404)
  if (proposal.status !== 'pending') return bad(res, 'Só é possível retirar propostas pendentes.', 409)
  db.prepare(`UPDATE proposals SET status = 'withdrawn' WHERE id = ?`).run(proposal.id)
  res.json({ ok: true })
})

export default router
