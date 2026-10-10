import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db, nowISO, notify } from '../db.js'
import { attachUser, setAuthCookie, clearAuthCookie, requireAuth, rateLimit } from '../auth.js'
import { bad, publicUser, cleanText, EMAIL_RE } from '../util.js'

const router = Router()

async function hashPassword(pw) {
  return bcrypt.hash(pw, 10)
}

router.post('/register', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  const role = req.body.role
  if (!['client', 'professional'].includes(role)) return bad(res, 'Tipo de conta inválido.')
  const name = cleanText(req.body.name, 120)
  const email = cleanText(req.body.email, 200).toLowerCase()
  const phone = cleanText(req.body.phone, 30)
  const city = cleanText(req.body.city, 120)
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (!name || name.length < 2) return bad(res, 'Informe seu nome completo.')
  if (!EMAIL_RE.test(email)) return bad(res, 'Informe um e-mail válido.')
  if (password.length < 8) return bad(res, 'A senha deve ter pelo menos 8 caracteres.')
  if (req.body.consent !== true) return bad(res, 'É necessário aceitar os Termos de Uso e a Política de Privacidade.')

  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return bad(res, 'Já existe uma conta com este e-mail.', 409)
  }

  const info = db.prepare(`INSERT INTO users (role, name, email, password_hash, phone, city, consent_at, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(role, name, email, await hashPassword(password), phone || null, city || null, nowISO(), nowISO(), nowISO())

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)

  if (role === 'professional') {
    db.prepare(`INSERT INTO professional_profiles (user_id, display_name, bio, categories, areas, offers_remote, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(user.id, name, '', '[]', '[]', 0, nowISO(), nowISO())
  }

  setAuthCookie(res, user)
  res.json({ user: publicUser(user) })
})

router.post('/login', rateLimit(15, 15 * 60 * 1000), async (req, res) => {
  const email = cleanText(req.body.email, 200).toLowerCase()
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return bad(res, 'E-mail ou senha incorretos.', 401)
  }
  if (user.status === 'suspended') return bad(res, 'Sua conta está suspensa. Entre em contato com o suporte.', 403)
  if (user.status !== 'active') return bad(res, 'Esta conta não está mais ativa.', 403)
  setAuthCookie(res, user)
  res.json({ user: publicUser(user) })
})

router.post('/logout', (req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

router.get('/me', attachUser, (req, res) => {
  if (!req.user) return res.json({ user: null })
  let profile = null
  if (req.user.role === 'professional') {
    profile = db.prepare('SELECT * FROM professional_profiles WHERE user_id = ?').get(req.user.id) || null
    if (profile) {
      profile.categories = JSON.parse(profile.categories || '[]')
      profile.areas = JSON.parse(profile.areas || '[]')
    }
  }
  const unread = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).c
  res.json({ user: publicUser(req.user), profile, unreadNotifications: unread })
})

router.put('/me', requireAuth, (req, res) => {
  const name = cleanText(req.body.name, 120)
  const phone = cleanText(req.body.phone, 30)
  const city = cleanText(req.body.city, 120)
  if (name && name.length < 2) return bad(res, 'Nome inválido.')
  db.prepare('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), city = COALESCE(?, city), updated_at = ? WHERE id = ?')
    .run(name || null, phone, city, nowISO(), req.user.id)
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) })
})

// Professional profile management
router.put('/professional/profile', requireAuth, (req, res) => {
  if (req.user.role !== 'professional') return bad(res, 'Apenas perfis profissionais podem editar este perfil.', 403)
  const prof = db.prepare('SELECT * FROM professional_profiles WHERE user_id = ?').get(req.user.id)
  if (!prof) return bad(res, 'Perfil não encontrado.', 404)

  const displayName = cleanText(req.body.display_name, 120)
  const bio = cleanText(req.body.bio, 3000)
  const accountType = ['individual', 'business'].includes(req.body.account_type) ? req.body.account_type : prof.account_type
  const categories = Array.isArray(req.body.categories)
    ? req.body.categories.filter((s) => typeof s === 'string' && db.prepare('SELECT id FROM service_categories WHERE slug = ? AND active = 1').get(s))
    : []
  const areas = Array.isArray(req.body.areas) ? req.body.areas.slice(0, 50).map((a) => cleanText(a, 80)).filter(Boolean) : []
  const offersRemote = !!req.body.offers_remote

  if (!displayName || displayName.length < 2) return bad(res, 'Informe o nome exibido.')
  if (categories.length === 0) return bad(res, 'Selecione ao menos uma categoria de atendimento.')

  db.prepare(`UPDATE professional_profiles
    SET display_name = ?, bio = ?, account_type = ?, categories = ?, areas = ?, offers_remote = ?, updated_at = ?
    WHERE user_id = ?`)
    .run(displayName, bio, accountType, JSON.stringify(categories), JSON.stringify(areas), offersRemote ? 1 : 0, nowISO(), req.user.id)

  const updated = db.prepare('SELECT * FROM professional_profiles WHERE user_id = ?').get(req.user.id)
  updated.categories = JSON.parse(updated.categories)
  updated.areas = JSON.parse(updated.areas)
  res.json({ profile: updated })
})

// LGPD: account deletion — personal data is anonymized, business records are retained.
router.delete('/me', requireAuth, (req, res) => {
  const anonymizedEmail = `removido-${req.user.id}-${Date.now()}@anonimizado.local`
  db.prepare(`UPDATE users SET name = 'Usuário removido', email = ?, phone = NULL, city = NULL, status = 'deleted', updated_at = ? WHERE id = ?`)
    .run(anonymizedEmail, nowISO(), req.user.id)
  if (req.user.role === 'professional') {
    db.prepare(`UPDATE professional_profiles SET display_name = 'Perfil removido', bio = '', categories = '[]', areas = '[]', offers_remote = 0, updated_at = ? WHERE user_id = ?`)
      .run(nowISO(), req.user.id)
  }
  clearAuthCookie(res)
  res.json({ ok: true })
})

export default router
