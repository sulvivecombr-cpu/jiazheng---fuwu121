import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(path.join(DATA_DIR, 'job.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export const nowISO = () => new Date().toISOString()

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK(role IN ('client','professional','admin')),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT,
      city TEXT,
      consent_at TEXT,
      notification_prefs TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deleted')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS professional_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      display_name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      account_type TEXT NOT NULL DEFAULT 'individual' CHECK(account_type IN ('individual','business')),
      categories TEXT NOT NULL DEFAULT '[]',
      areas TEXT NOT NULL DEFAULT '[]',
      offers_remote INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      verification_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS service_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id),
      category_id INTEGER NOT NULL REFERENCES service_categories(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      service_type TEXT NOT NULL CHECK(service_type IN ('local','digital')),
      city TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      preferred_date TEXT NOT NULL DEFAULT '',
      budget_min INTEGER,
      budget_max INTEGER,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','PROPOSALS_AVAILABLE','PROFESSIONAL_SELECTED','IN_PROGRESS','COMPLETED','CANCELLED','DISPUTED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_requests_client ON service_requests(client_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON service_requests(status);

    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL REFERENCES service_requests(id),
      professional_id INTEGER NOT NULL REFERENCES users(id),
      price_cents INTEGER NOT NULL,
      description TEXT NOT NULL,
      timeframe TEXT NOT NULL DEFAULT '',
      conditions TEXT NOT NULL DEFAULT '',
      valid_until TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','not_selected','withdrawn')),
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_unique ON proposals(request_id, professional_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_request ON proposals(request_id);

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL UNIQUE REFERENCES service_requests(id),
      proposal_id INTEGER NOT NULL REFERENCES proposals(id),
      client_id INTEGER NOT NULL REFERENCES users(id),
      professional_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED','SCHEDULED','IN_PROGRESS','PENDING_CONFIRMATION','COMPLETED','CANCELLED','DISPUTED')),
      scheduled_date TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id),
      sender_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_job ON messages(job_id);

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id),
      client_id INTEGER NOT NULL REFERENCES users(id),
      professional_id INTEGER NOT NULL REFERENCES users(id),
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL REFERENCES users(id),
      target_type TEXT NOT NULL CHECK(target_type IN ('user','request','job','review')),
      target_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `)
}

export function notify(userId, type, title, body = '', link = '') {
  db.prepare('INSERT INTO notifications (user_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?)')
    .run(userId, type, title, body, link, nowISO())
}

export function audit(actorId, action, target = '', details = {}) {
  db.prepare('INSERT INTO audit_logs (actor_id, action, target, details, created_at) VALUES (?,?,?,?,?)')
    .run(actorId, action, target, JSON.stringify(details), nowISO())
}
