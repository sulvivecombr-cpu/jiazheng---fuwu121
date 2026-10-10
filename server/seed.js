import { db, nowISO } from './db.js'

// Seeds ONLY configuration data (service categories). Never creates users,
// requests, proposals, reviews or any marketplace activity.
const CATEGORIES = [
  ['limpeza-faxina', 'Limpeza & Faxina', '🧽'],
  ['eletricista', 'Eletricista', '💡'],
  ['encanador', 'Encanador', '🔧'],
  ['pintura', 'Pintura', '🎨'],
  ['montagem-moveis', 'Montagem de Móveis', '🪛'],
  ['mudanca-frete', 'Mudança & Frete', '🚚'],
  ['jardinagem', 'Jardinagem & Manutenção', '🌿'],
  ['reformas', 'Reformas & Reparos', '🧱'],
  ['cuidados-domesticos', 'Cuidados & Serviços Domésticos', '🤝'],
  ['design-marketing', 'Design & Marketing', '🖌️'],
  ['programacao-ti', 'Programação & TI', '💻'],
  ['outros', 'Outros Serviços', '🧰'],
]

export function seedCategories() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM service_categories').get().c
  if (count > 0) return
  const insert = db.prepare('INSERT INTO service_categories (slug, name, active, sort_order, icon) VALUES (?,?,?,?,?)')
  const tx = db.transaction(() => {
    CATEGORIES.forEach(([slug, name, icon], i) => insert.run(slug, name, 1, i, icon))
  })
  tx()
  // Keep existing rows' icons in sync (idempotent configuration update).
  const setIcon = db.prepare('UPDATE service_categories SET icon = ? WHERE slug = ? AND (icon IS NULL OR icon = \'\')')
  CATEGORIES.forEach(([slug, , icon]) => setIcon.run(icon, slug))
  console.log('Seeded service categories (configuration data).')
}
