import { Router } from 'express'
import { db, nowISO } from '../db.js'
import { requireAuth } from '../auth.js'
import { bad } from '../util.js'

const router = Router()

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id)
  res.json({ notifications: rows })
})

router.post('/mark-read', requireAuth, (req, res) => {
  if (req.body.id != null) {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.body.id, req.user.id)
  } else {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id)
  }
  res.json({ ok: true })
})

export default router
