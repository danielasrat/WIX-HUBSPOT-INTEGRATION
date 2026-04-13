# Wix <-> HubSpot Integration (Self-Hosted)

Production-style assignment implementation for:
- Reliable bi-directional contact sync
- Wix form -> HubSpot lead capture with attribution
- OAuth connection management
- User-configurable mapping UI

## Project Structure
- `backend/`: Express + TypeScript API, queue worker, Prisma models.
- `frontend/`: React dashboard for connection + mappings.
- `docs/`: API plan, architecture, and testing checklist.

## Feature Coverage

### Feature #1: Bi-directional Contact Sync
- Supports create/update both directions:
  - Wix -> HubSpot
  - HubSpot -> Wix
- Mapping table controls sync fields and direction.
- Deterministic conflict handling: last-updated-wins.
- Infinite loop prevention:
  - External ID mapping (`ContactLink`)
  - Sync dedupe (`SyncEventLog` with source + syncId)
  - Correlation IDs + origin filtering
- Idempotency: payload hash skip for identical writes.

### Feature #2: Form and Lead Capture
- Chosen approach: Wix forms as source UI.
- Submission webhook -> queue -> HubSpot contact upsert.
- Captures and stores attribution context:
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
  - `pageUrl`, `referrer`, `formTimestamp`
- Stores minimal observability record in `LeadEvent`.

### Security
- HubSpot OAuth 2.0 (no API keys in frontend).
- Access/refresh tokens encrypted at rest.
- Token refresh flow handled server-side.
- Dashboard API auth via bearer token.
- Webhook auth via shared secret header.
- Least privilege HubSpot scopes for contacts + properties reads.

## Environment Variables

Create `backend/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wix_hubspot
REDIS_URL=redis://127.0.0.1:6379

# Security
TOKEN_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
DASHBOARD_API_TOKEN=<strong-random-token>
WEBHOOK_SHARED_SECRET=<strong-random-secret>

# HubSpot OAuth
HUBSPOT_CLIENT_ID=<client-id>
HUBSPOT_CLIENT_SECRET=<client-secret>
HUBSPOT_REDIRECT_URI=http://localhost:5000/api/auth/hubspot/callback

# Optional Wix self-hosted contacts bridge
WIX_CONTACTS_API_BASE_URL=
WIX_APP_TOKEN=
```

Create `frontend/.env`:

```env
VITE_DASHBOARD_API_TOKEN=<same-as-backend-DASHBOARD_API_TOKEN>
VITE_WIX_SITE_ID=demo-site
```

Generate encryption key example (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

Quick start option:
- Copy `backend/.env.example` to `backend/.env` and fill values.
- Copy `frontend/.env.example` to `frontend/.env` and fill values.

## Local Setup

1. Install backend deps:
```bash
cd backend
npm install
```

2. Install frontend deps:
```bash
cd ../frontend
npm install
```

3. Prepare database:
```bash
cd ../backend
npm run prisma:generate
npm run prisma:migrate
```

4. Start backend API:
```bash
npm run dev
```

5. Start worker (new terminal):
```bash
cd backend
npm run worker
```

6. Start frontend (new terminal):
```bash
cd frontend
npm run dev
```

## Deliverables
- API usage plan: `docs/API_PLAN.md`
- Architecture design: `docs/ARCHITECTURE.md`
- Test checklist + sample payloads: `docs/TESTING.md`
- Submission draft to hiring team: `docs/SUBMISSION_TEMPLATE.md`

## Notes for Wix CLI / Self-Hosted
- This repo is implemented as self-hosted backend + dashboard.
- To package as Wix app listing, connect dashboard and webhook endpoints into Wix app extensions and production deployment.
