import { Router } from 'express'
import { db, nowISO, audit } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { bad, cleanText } from '../util.js'
import { eligibleProfessionalsFor } from '../matching.js'

const router = Router()

const VALID_TRANSITIONS = {
  OPEN: ['PROPOSALS_AVAILABLE', 'CANCELLED'],
  PROPOSALS_AVAILABLE: ['PROFESSIONAL_SELECTED', 'CANCELLED'],
  PROFESSIONAL_SELECTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['COMPLETED', 'CANCELLED'],
}

function canTransition(from, to) {
  return (VALID_TRANSITIONS[from] || []).includes(to)
}

function getRequest(id) {
  return db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id)
}

function canViewRequest(req, request) {
  if (req.user.role === 'admin') return true
  if (request.client_id === req.user.id) return true
  if (req.user.role !== 'professional') return false
  const prof = db.prepare('SELECT user_id, categories FROM professional_profiles WHERE user_id = ?').get(req.user.id)
  if (!prof) return false
  // Professionals may see open requests while proposals are being received,
  // but only if they are eligible: their profile covers the request's category.
  if (!['OPEN', 'PROPOSALS_AVAILABLE'].includes(request.status)) return false
  const slug = db.prepare('SELECT slug FROM service_categories WHERE id = ?').get(request.category_id)?.slug
  return (JSON.parse(prof.categories || '[]')).includes(slug)
}

// POST /api/requests — create (clients only)
router.post('/', requireRole('client'), (req, res) => {
  const category = db.prepare('SELECT * FROM service_categories WHERE id = ? AND active = 1').get(req.body.category_id)
  if (!category) return bad(res, 'Selecione uma categoria válida.')
  const title = cleanText(req.body.title, 120)
  const description = cleanText(req.body.description, 4000)
  const serviceType = req.body.service_type === 'digital' ? 'digital' : req.body.service_type === 'local' ? 'local' : null
  const city = cleanText(req.body.city, 120)
  const address = cleanText(req.body.address, 300)
  const preferredDate = cleanText(req.body.preferred_date, 40)
  const budgetMin = req.body.budget_min == null || req.body.budget_min === '' ? null : Number(req.body.budget_min)
  const budgetMax = req.body.budget_max == null || req.body.budget_max === '' ? null : Number(req.body.budget_max)

  if (title.length < 5) return bad(res, 'O título deve ter pelo menos 5 caracteres.')
  if (description.length < 20) return bad(res, 'Descreva o serviço com pelo menos 20 caracteres.')
  if (!serviceType) return bad(res, 'Informe se o serviço é presencial ou digital.')
  if (serviceType === 'local' && !city) return bad(res, 'Informe a cidade para serviços presenciais.')
  if (budgetMin != null && (isNaN(budgetMin) || budgetMin < 0)) return bad(res, 'Orçamento mínimo inválido.')
  if (budgetMax != null && (isNaN(budgetMax) || budgetMax < 0)) return bad(res, 'Orçamento máximo inválido.')
  if (budgetMin != null && budgetMax != null && budgetMin > budgetMax) return bad(res, 'O orçamento mínimo não pode ser maior que o máximo.')

  const info = db.prepare(`INSERT INTO service_requests
    (client_id, category_id, title, description, service_type, city, address, preferred_date, budget_min, budget_max, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, category.id, title, description, serviceType, serviceType === 'local' ? city : '', address,
      preferredDate, budgetMin, budgetMax, 'OPEN', nowISO(), nowISO())

  res.json({ request: getRequest(info.lastInsertRowid) })
})

// GET /api/requests — role-scoped listing
router.get('/', requireAuth, (req, res) => {
  if (req.user.role === 'client') {
    const requests = db.prepare(`
      SELECT r.*, c.name AS category_name FROM service_requests r
      JOIN service_categories c ON c.id = r.category_id
      WHERE r.client_id = ? ORDER BY r.created_at DESC`).all(req.user.id)
    return res.json({ requests })
  }

  if (req.user.role === 'professional') {
    const prof = db.prepare('SELECT * FROM professional_profiles WHERE user_id = ?').get(req.user.id)
    if (!prof) return res.json({ requests: [], note: 'Complete seu perfil profissional para receber solicitações.' })
    const cats = JSON.parse(prof.categories || '[]')
    if (cats.length === 0) return res.json({ requests: [], note: 'Selecione suas categorias de atendimento no perfil para ver solicitações.' })

    const rows = db.prepare(`
      SELECT r.*, c.name AS category_name, c.slug AS category_slug FROM service_requests r
      JOIN service_categories c ON c.id = r.category_id
      WHERE r.status IN ('OPEN','PROPOSALS_AVAILABLE') ORDER BY r.created_at DESC LIMIT 200`).all()
    const mine = new Set(db.prepare('SELECT request_id FROM proposals WHERE professional_id = ?').all(req.user.id).map((p) => p.request_id))

    const matching = rows
      .map((r) => {
        const eligible = eligibleProfessionalsFor(r).find((m) => m.user_id === req.user.id)
        if (!eligible && !mine.has(r.id)) return null
        return { ...r, already_proposed: mine.has(r.id), match_reasons: eligible ? eligible.reasons : ['Você já enviou uma proposta'] }
      })
      .filter(Boolean)
    return res.json({ requests: matching })
  }

  // admin
  const requests = db.prepare(`
    SELECT r.*, c.name AS category_name, u.name AS client_name FROM service_requests r
    JOIN service_categories c ON c.id = r.category_id JOIN users u ON u.id = r.client_id
    ORDER BY r.created_at DESC LIMIT 500`).all()
  res.json({ requests })
})

// GET /api/requests/:id
router.get('/:id', requireAuth, (req, res) => {
  const request = db.prepare(`
    SELECT r.*, c.name AS category_name FROM service_requests r
    JOIN service_categories c ON c.id = r.category_id WHERE r.id = ?`).get(req.params.id)
  if (!request) return bad(res, 'Solicitação não encontrada.', 404)
  if (!canViewRequest(req, request)) return bad(res, 'Você não tem permissão para ver esta solicitação.', 403)

  const client = db.prepare('SELECT id, name FROM users WHERE id = ?').get(request.client_id)
  const job = db.prepare('SELECT id, status FROM jobs WHERE request_id = ?').get(request.id)
  const myProposal = req.user.role === 'professional'
    ? db.prepare('SELECT * FROM proposals WHERE request_id = ? AND professional_id = ?').get(request.id, req.user.id)
    : null
  const proposalCount = db.prepare(`SELECT COUNT(*) AS c FROM proposals WHERE request_id = ? AND status IN ('pending','accepted')`).get(request.id).c

  res.json({ request: { ...request, client_name: client?.name }, job, myProposal, proposalCount })
})

// POST /api/requests/:id/action — validated lifecycle transitions (client)
router.post('/:id/action', requireAuth, (req, res) => {
  const request = getRequest(req.params.id)
  if (!request) return bad(res, 'Solicitação não encontrada.', 404)
  if (request.client_id !== req.user.id && req.user.role !== 'admin') {
    return bad(res, 'Você não tem permissão para alterar esta solicitação.', 403)
  }
  const action = req.body.action
  const now = nowISO()

  if (action === 'close_receiving') {
    if (!canTransition(request.status, 'PROPOSALS_AVAILABLE')) return bad(res, 'Esta solicitação não pode ser atualizada agora.', 409)
    db.prepare(`UPDATE service_requests SET status = 'PROPOSALS_AVAILABLE', updated_at = ? WHERE id = ?`).run(now, request.id)
    return res.json({ request: getRequest(request.id) })
  }

  if (action === 'cancel') {
    if (!canTransition(request.status, 'CANCELLED')) return bad(res, 'Esta solicitação não pode mais ser cancelada.', 409)
    const job = db.prepare('SELECT * FROM jobs WHERE request_id = ?').get(request.id)
    if (job && !['CONFIRMED', 'SCHEDULED'].includes(job.status)) {
      return bad(res, 'O trabalho já está em andamento e não pode ser cancelado por aqui.', 409)
    }
    const tx = db.transaction(() => {
      db.prepare(`UPDATE service_requests SET status = 'CANCELLED', updated_at = ? WHERE id = ?`).run(now, request.id)
      if (job) db.prepare(`UPDATE jobs SET status = 'CANCELLED', updated_at = ? WHERE id = ?`).run(now, job.id)
    })
    tx()
    return res.json({ request: getRequest(request.id) })
  }

  if (action === 'dispute') {
    if (!canTransition(request.status, 'DISPUTED')) return bad(res, 'Não é possível registrar disputa nesta solicitação.', 409)
    db.prepare(`UPDATE service_requests SET status = 'DISPUTED', updated_at = ? WHERE id = ?`).run(now, request.id)
    return res.json({ request: getRequest(request.id) })
  }

  return bad(res, 'Ação desconhecida.')
})

export { canTransition }
export default router
