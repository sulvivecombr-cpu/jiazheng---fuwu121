import { db, nowISO } from './db.js'

export const bad = (res, message, status = 400) => res.status(status).json({ error: message })
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const parseJSON = (v, fallback) => { try { return v == null ? fallback : JSON.parse(v) } catch { return fallback } }

export function publicUser(u) {
  if (!u) return null
  return { id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone || '', city: u.city || '', status: u.status }
}

export function cleanText(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
