import { db } from './db.js'
import { parseJSON } from './util.js'

// Deterministic, explainable rule-based matching (Phase 5).
// Criteria, in order: category compatibility, service-type compatibility
// (local coverage vs remote offering), and active account standing.
// No fabricated ranking signals: only real, recorded profile data.

export function eligibleProfessionalsFor(request) {
  const category = db.prepare('SELECT * FROM service_categories WHERE id = ?').get(request.category_id)
  if (!category) return []

  const profiles = db.prepare(`
    SELECT p.*, u.name AS user_name, u.city AS user_city, u.status AS user_status
    FROM professional_profiles p JOIN users u ON u.id = p.user_id
    WHERE u.role = 'professional' AND u.status = 'active'
  `).all()

  const results = []
  for (const p of profiles) {
    const reasons = []
    const cats = parseJSON(p.categories, [])
    const areas = parseJSON(p.areas, [])
    const offersRemote = !!p.offers_remote

    if (!cats.includes(category.slug)) continue
    reasons.push(`Atua em ${category.name}`)

    if (request.service_type === 'digital') {
      if (!offersRemote) continue
      reasons.push('Atende remotamente')
    } else {
      const cityMatch = areas.some((a) => a.trim().toLowerCase() === (request.city || '').trim().toLowerCase())
      if (!cityMatch) continue
      reasons.push(`Atende ${request.city}`)
    }

    if (p.verified) reasons.push('Perfil verificado pela equipe JOB')

    results.push({
      profile_id: p.id,
      user_id: p.user_id,
      display_name: p.display_name,
      verified: !!p.verified,
      reasons,
    })
  }
  return results
}
