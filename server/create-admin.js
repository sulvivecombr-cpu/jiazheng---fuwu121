// Creates an ADMIN account. Run manually inside the container:
//   node server/create-admin.js <email> <password> <name>
// Admin accounts are created deliberately by an operator — never auto-seeded.
import bcrypt from 'bcryptjs'
import { db, initDb, nowISO } from './db.js'
import { EMAIL_RE } from './util.js'

initDb()
const [email, password, name] = process.argv.slice(2)

if (!email || !password || !name) {
  console.error('Uso: node server/create-admin.js <email> <senha> <nome>')
  process.exit(1)
}
if (!EMAIL_RE.test(email) || password.length < 8) {
  console.error('E-mail inválido ou senha com menos de 8 caracteres.')
  process.exit(1)
}

if (db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())) {
  console.error('Já existe uma conta com este e-mail.')
  process.exit(1)
}

db.prepare(`INSERT INTO users (role, name, email, password_hash, consent_at, created_at, updated_at)
  VALUES ('admin', ?, ?, ?, ?, ?, ?)`)
  .run(name, email.toLowerCase(), bcrypt.hashSync(password, 10), nowISO(), nowISO(), nowISO())

console.log(`Conta admin criada para ${email.toLowerCase()}.`)
