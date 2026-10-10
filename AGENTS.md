# JOB — Service Marketplace (Base44 dev environment)

## What this repo is
A full marketplace app ("JOB", Brazilian service marketplace, pt-BR UI) built from scratch in this
sandbox. The original imported repository contained only a README + screenshots (a showcase page for
a Chinese housekeeping project, https://github.com/Zhidian2024/jiazheng---fuwu121.git — reference
only, no source code was imported or ported).

## Stack
- **Single Node 22 service**: Express API (`server/`) + Vite dev server in middleware mode serving the
  React SPA (`client/`) on one origin, port 3000.
- **SQLite** (better-sqlite3) stored in `/app/data/job.db` on the named volume `job_data`.
  No separate DB container needed. Sessions: JWT in an HttpOnly cookie (`job_token`).
- Dependencies install at container start from `package.json` into the `web_node_modules` volume;
  server code is watched by nodemon; frontend has HMR via Vite middleware.

## Running / verifying
```
docker compose -f docker-compose.base44.yml up -d
curl http://localhost:3000/api/health   # {"ok":true}
```
- Admin accounts are NEVER auto-seeded: `docker compose -f docker-compose.base44.yml exec web node server/create-admin.js <email> <password> <name>`
- End-to-end smoke test script lives at `/tmp/verify.sh` (not committed): registers test accounts and
  walks request → proposals (limit 3) → accept → job lifecycle → messages → review → access-control checks.

## Sandbox-only overrides (BASE44_PREVIEW_MODE / dev)
- Vite accepts the preview host via the platform-provided `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`
  env var (passed through in compose; bare entry — no hardcoded host).
- Auth cookies are `Secure` only when `NODE_ENV=production`; development allows plain HTTP for curl
  verification. Original behavior preserved when the flag/env is absent.

## Test accounts (sandbox only — never for production)
Created during verification (suffix -r6): `cliente.teste-r6@job.test`, `prof.teste-r6@job.test`,
`prof2.teste-r6@job.test`, `pro3/pro4@…`, `admin@job.test` / `AdminJob2026`. These are synthetic
sandbox fixtures, clearly labeled "(sandbox)"; production must never be seeded with them.

## Data-integrity rules baked into the app
- Only configuration data (service categories) is seeded. No fake users/requests/proposals/reviews.
- Professional "verified" badge only via explicit admin action (audited).
- Ratings appear only when real reviews exist; empty states everywhere data is absent.
- Proposal limit: 3 per request, enforced server-side; request visibility requires category eligibility.

## Known limitations (honest status)
- Attachments/photos on requests: NOT implemented (needs a file-storage decision).
- Payments: NOT configured (Stripe declared available in region; needs credentials + commercial/legal
  sign-off). Admin dashboard shows an explicit "not configured" notice.
- Messaging: manual refresh + 10s polling on the job page (JobDetail) — NOT real-time chat.
- Notifications: in-app only (no e-mail/SMS provider connected).
- Matching: deterministic rules (category + coverage/remote + verified note), explainable, no fabricated signals.
