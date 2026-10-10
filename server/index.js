import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb } from './db.js'
import { seedCategories } from './seed.js'
import { attachUser } from './auth.js'
import authRoutes from './routes/auth.js'
import directoryRoutes from './routes/directory.js'
import requestRoutes from './routes/requests.js'
import proposalRoutes from './routes/proposals.js'
import jobRoutes from './routes/jobs.js'
import adminRoutes from './routes/admin.js'
import notificationRoutes from './routes/notifications.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

initDb()
seedCategories()

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

// Security headers (minimal, SPA-friendly; preview proxy handles framing concerns).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  next()
})

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use(attachUser)
app.use('/api/auth', authRoutes)
app.use('/api', directoryRoutes)          // public: categories, professionals
app.use('/api/requests', requestRoutes)
app.use('/api', proposalRoutes)           // proposal endpoints include request paths
app.use('/api/jobs', jobRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/notifications', notificationRoutes)

app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso não encontrado.' }))

// Frontend: Vite dev server (middleware mode) in development, static build in production.
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite')
  const vite = await createServer({
    config: path.join(repoRoot, 'vite.config.js'),
    server: { middlewareMode: true, host: true },
    appType: 'spa',
  })
  app.use(vite.middlewares)
  console.log('Vite dev middleware enabled (live reload).')
} else {
  const dist = path.join(repoRoot, 'dist')
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))
  console.log('Serving static production build from dist/.')
}

const PORT = Number(process.env.PORT || 3000)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`JOB running on http://0.0.0.0:${PORT}`)
})
