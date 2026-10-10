import { Router } from 'express'
import { db } from '../db.js'
import { parseJSON } from '../util.js'

const router = Router()

// Public configuration data.
router.get('/categories', (req, res) => {
  res.json({ categories: db.prepare('SELECT id, slug, name, icon FROM service_categories WHERE active = 1 ORDER BY sort_order').all() })
})

// Public professional directory — only real, active profiles. No fabricated data.
router.get('/professionals', (req, res) => {
  const categoria = (req.query.categoria || '').toString().trim()
  const cidade = (req.query.cidade || '').toString().trim()
  const remoto = (req.query.remoto || '').toString() === '1'

  let sql = `
    SELECT p.id, p.display_name, p.bio, p.categories, p.areas, p.offers_remote, p.verified, u.city
    FROM professional_profiles p JOIN users u ON u.id = p.user_id
    WHERE u.status = 'active' AND u.role = 'professional'`
  const params = []
  if (remoto) { sql += ' AND p.offers_remote = 1' }
  if (categoria) {
    sql += ' AND EXISTS (SELECT 1 FROM json_each(p.categories) je WHERE je.value = ?)'
    params.push(categoria)
  }
  sql += ' ORDER BY p.verified DESC, p.updated_at DESC LIMIT 100'
  const rows = db.prepare(sql).all(...params)

  const results = rows
    .map((p) => {
      const cats = parseJSON(p.categories, [])
      const areas = parseJSON(p.areas, [])
      const cityMatch = cidade && areas.some((a) => a.trim().toLowerCase() === cidade.trim().toLowerCase())
      if (cidade && !cityMatch) return null
      const rating = db.prepare('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE professional_id = ?').get(
        db.prepare('SELECT user_id FROM professional_profiles WHERE id = ?').get(p.id)?.user_id
      )
      return {
        id: p.id,
        display_name: p.display_name,
        bio: p.bio,
        categories: cats,
        areas,
        offers_remote: !!p.offers_remote,
        verified: !!p.verified,
        city: p.city || '',
        rating: rating && rating.n > 0 ? { avg: Math.round(rating.avg * 10) / 10, count: rating.n } : null,
      }
    })
    .filter(Boolean)

  res.json({ professionals: results })
})

export default router
