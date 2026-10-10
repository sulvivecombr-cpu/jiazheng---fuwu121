import jwt from 'jsonwebtoken'
import { db } from './db.js'

const COOKIE = 'job_token'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Provide it via the environment (e.g. /run/base44/app.env).')
  process.exit(1)
}

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' })
}

function cookieAttrs() {
  // Original behavior: secure cookies in production; plain HTTP allowed in development.
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export function setAuthCookie(res, user) {
  res.setHeader('Set-Cookie', `${COOKIE}=${signToken(user)}; ${cookieAttrs()}`)
}

export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

function parseCookies(header) {
  const out = {}
  for (const part of (header || '').split(';')) {
    if (!part.trim()) continue
    const i = part.indexOf('=')
    if (i < 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export function attachUser(req, res, next) {
  req.cookies = parseCookies(req.headers.cookie)
  req.user = null
  const token = req.cookies[COOKIE]
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      const user = db.prepare('SELECT id, role, name, email, status FROM users WHERE id = ?').get(payload.id)
      if (user && user.status === 'active') req.user = user
    } catch { /* invalid/expired token -> anonymous */ }
  }
  next()
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.' })
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Você não tem permissão para esta ação.' })
    next()
  }
}

// Simple in-memory rate limiter for sensitive endpoints (auth, messaging).
export function rateLimit(max, windowMs) {
  const hits = new Map()
  return (req, res, next) => {
    const key = `${req.ip || req.socket.remoteAddress}:${req.path}`
    const now = Date.now()
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs)
    recent.push(now)
    hits.set(key, recent)
    if (recent.length > max) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' })
    next()
  }
}
