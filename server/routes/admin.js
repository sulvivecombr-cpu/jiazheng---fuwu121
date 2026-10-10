import { Router } from 'express'
import { db, nowISO, notify, audit } from '../db.js'
import { requireRole } from '../auth.js'
import { bad, cleanText, parseJSON, publicUser } from '../util.js'

const router = Router()
router.use(requireRole('admin'))

// Operational dashboard — counts from real records only.
router.get('/stats', (req, res) => {
  const count = (sql) => db.prepare(sql).get().c
  res.json({
    clients: count(`SELECT COUNT(*) c FROM users WHERE role='client' AND status != 'deleted'`),
    professionals: count(`SELECT COUNT(*) c FROM users WHERE role='professional' AND status != 'deleted'`),
    requests: count(`SELECT COUNT(*) c FROM service_requests`),
    openRequests: count(`SELECT COUNT(*) c FROM service_requests WHERE status IN ('OPEN','PROPOSALS_AVAILABLE')`),
    proposals: count(`SELECT COUNT(*) c FROM proposals`),
    jobs: count(`SELECT COUNT(*) c FROM jobs`),
    completedJobs: count(`SELECT COUNT(*) c FROM jobs WHERE status='COMPLETED'`),
    openReports: count(`SELECT COUNT(*) c FROM reports WHERE status='open'`),
    pendingVerifications: count(`SELECT COUNT(*) c FROM professional_profiles WHERE verified=0`),
  })
})

router.get('/users', (req, res) => {
  const role = (req.query.role || '').toString()
  const q = (req.query.q || '').toString().toLowerCase()
  let sql = `SELECT id, role, name, email, phone, city, status, created_at FROM users WHERE status != 'deleted'`
  const params = []
  if (['client', 'professional', 'admin'].includes(role)) { sql += ' AND role = ?'; params.push(role) }
  if (q) { sql += ' AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
  sql += ' ORDER BY created_at DESC LIMIT 300'
  res.json({ users: db.prepare(sql).all(...params) })
})

router.post('/users/:id/status', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return bad(res, 'Usuário não encontrado.', 404)
  if (user.id === req.user.id) return bad(res, 'Você não pode alterar o status da sua própria conta.', 409)
  const status = req.body.status
  if (!['active', 'suspended'].includes(status)) return bad(res, 'Status inválido.')
  db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(status, nowISO(), user.id)
  audit(req.user.id, `user.${status}`, `user:${user.id}`, { email: user.email })
  res.json({ ok: true })
})

router.get('/professionals', (req, res) => {
  const rows = db.prepare(`
    SELECT pp.*, u.name, u.email, u.status AS user_status FROM professional_profiles pp
    JOIN users u ON u.id = pp.user_id WHERE u.status != 'deleted' ORDER BY pp.created_at DESC`).all()
  res.json({
    professionals: rows.map((p) => ({ ...p, categories: parseJSON(p.categories, []), areas: parseJSON(p.areas, []) })),
  })
})

router.post('/professionals/:userId/verification', (req, res) => {
  const prof = db.prepare('SELECT * FROM professional_profiles WHERE user_id = ?').get(req.params.userId)
  if (!prof) return bad(res, 'Perfil profissional não encontrado.', 404)
  const verified = req.body.verified === true
  const note = cleanText(req.body.note, 500)
  db.prepare('UPDATE professional_profiles SET verified = ?, verification_note = ?, updated_at = ? WHERE user_id = ?')
    .run(verified ? 1 : 0, note, nowISO(), prof.user_id)
  audit(req.user.id, verified ? 'professional.verified' : 'professional.unverified', `user:${prof.user_id}`, { note })
  notify(prof.user_id, 'verification', verified ? 'Perfil verificado' : 'Verificação atualizada',
    verified ? 'Seu perfil profissional foi verificado pela equipe JOB.' : 'O status de verificação do seu perfil foi atualizado.', '/pro')
  res.json({ ok: true })
})

router.get('/categories', (req, res) => {
  res.json({ categories: db.prepare('SELECT * FROM service_categories ORDER BY sort_order').all() })
})

router.post('/categories', (req, res) => {
  const slug = cleanText(req.body.slug, 60).toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const name = cleanText(req.body.name, 80)
  if (!slug || !name) return bad(res, 'Informe o identificador (slug) e o nome da categoria.')
  if (db.prepare('SELECT id FROM service_categories WHERE slug = ?').get(slug)) return bad(res, 'Já existe uma categoria com este identificador.', 409)
  db.prepare('INSERT INTO service_categories (slug, name, active, sort_order) VALUES (?,?,1,99)').run(slug, name)
  audit(req.user.id, 'category.created', `category:${slug}`, { name })
  res.json({ ok: true })
})

router.patch('/categories/:id', (req, res) => {
  const cat = db.prepare('SELECT * FROM service_categories WHERE id = ?').get(req.params.id)
  if (!cat) return bad(res, 'Categoria não encontrada.', 404)
  const name = req.body.name != null ? cleanText(req.body.name, 80) : cat.name
  const active = req.body.active != null ? (req.body.active ? 1 : 0) : cat.active
  if (!name) return bad(res, 'Nome inválido.')
  db.prepare('UPDATE service_categories SET name = ?, active = ? WHERE id = ?').run(name, active, cat.id)
  audit(req.user.id, 'category.updated', `category:${cat.slug}`, { name, active })
  res.json({ ok: true })
})

router.get('/reports', (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, u.name AS reporter_name FROM reports r JOIN users u ON u.id = r.reporter_id
    ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 300`).all()
  res.json({ reports: rows })
})

router.post('/reports/:id/status', (req, res) => {
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id)
  if (!report) return bad(res, 'Denúncia não encontrada.', 404)
  const status = req.body.status
  if (!['resolved', 'dismissed'].includes(status)) return bad(res, 'Status inválido.')
  db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, report.id)
  audit(req.user.id, `report.${status}`, `report:${report.id}`, {})
  res.json({ ok: true })
})

router.get('/audit', (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
    ORDER BY a.created_at DESC LIMIT 300`).all()
  res.json({ logs: rows })
})

export default router
