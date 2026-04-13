# Architecture

## Stack
- Frontend: React + Vite dashboard for OAuth and field mapping configuration.
- Backend: Node.js + TypeScript + Express.
- Queue: BullMQ + Redis for resilient async sync processing.
- Database: PostgreSQL + Prisma.

## Core Components

### 1) Dashboard (Frontend)
- Connect/disconnect HubSpot.
- Show connection status + token expiry.
- Configure field mappings:
  - Wix field
  - HubSpot property
  - Direction (`wix-to-hubspot`, `hubspot-to-wix`, `bidirectional`)
  - Optional transform/default value

### 2) API Layer (Backend)
- Auth routes for OAuth lifecycle.
- Mapping routes for mapping persistence and validation.
- Webhook routes for Wix and HubSpot event ingestion.

### 3) Sync Worker
- Consumes queue jobs.
- Applies mapping rules.
- Executes conflict handling and idempotency checks.
- Writes to HubSpot and Wix targets.

### 4) Persistence Model
- `IntegrationConnection`: site-level connection and encrypted tokens.
- `OAuthState`: short-lived anti-CSRF state for OAuth.
- `FieldMapping`: per-site mapping rules.
- `ContactLink`: external ID mapping and sync state snapshots.
- `SyncEventLog`: dedupe and anti-loop window.
- `LeadEvent`: observability log for form submissions + attribution.

## Data Flows

### Wix -> HubSpot Contact Sync
1. Wix emits contact update event.
2. Backend receives event at `/webhooks/wix/contact`.
3. Event queued with `syncId`, `correlationId`, and source metadata.
4. Worker loads site mapping + contact link.
5. If dedupe/idempotency/conflict rules pass, worker upserts HubSpot contact.
6. Contact link is updated with IDs, timestamps, hashes.

### HubSpot -> Wix Contact Sync
1. HubSpot webhook arrives at `/webhooks/hubspot`.
2. Backend resolves target Wix site by `portalId`.
3. Event queued for worker.
4. Worker applies reverse field mapping and conflict checks.
5. Worker upserts Wix contact.
6. Contact link is updated.

### Wix Form -> HubSpot Lead Capture
1. Wix form submission arrives at `/webhooks/wix/form`.
2. Minimal observability payload stored in `LeadEvent`.
3. Worker maps form/contact fields, including UTM and source context.
4. HubSpot contact is created/updated within seconds.

## Reliability and Safety
- Queue retries with exponential backoff.
- Deterministic conflict handling (last-updated-wins).
- Sync loop prevention using event dedupe (`source + syncId`) and origin filtering.
- Idempotent write skip using payload hash comparison.
- Tokens encrypted at rest and refreshed server-side.
- API and webhook authentication required.
