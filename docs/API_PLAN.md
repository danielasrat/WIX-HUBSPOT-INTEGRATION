# API Plan - Wix <-> HubSpot Integration

## Feature #1: Reliable Bi-Directional Contact Sync

### Wix APIs / Events
- Wix Contacts events (create/update) via webhook relay into backend endpoint `/webhooks/wix/contact`.
- Wix Form submission events via `/webhooks/wix/form` (chosen approach for Feature #2).
- Optional Wix Contacts REST endpoint (external service) for upsert from HubSpot -> Wix.

Why:
- Webhooks are low latency and event-driven (seconds-level sync target).
- Upsert endpoint enables deterministic create/update behavior from HubSpot side.

### HubSpot APIs / Events
- OAuth 2.0 authorize + token endpoints:
  - `GET https://app.hubspot.com/oauth/authorize`
  - `POST https://api.hubapi.com/oauth/v1/token`
- Contacts API:
  - `POST /crm/v3/objects/contacts` (create)
  - `PATCH /crm/v3/objects/contacts/{id}` (update)
  - `POST /crm/v3/objects/contacts/search` (lookup by email)
- Properties API:
  - `GET /crm/v3/properties/contacts` (mapping dropdown)
- HubSpot webhook subscription delivery endpoint in app: `/webhooks/hubspot`.

Why:
- Contacts API is required for create/update and conflict resolution writes.
- Properties API is required for user-configurable field mapping UI.
- Webhooks are required to support HubSpot -> Wix updates in near-real-time.

### Sync Rules and Reliability Strategy
- External ID map table: `ContactLink` tracks `wixContactId <-> hubspotContactId`.
- Deterministic conflict handling: last-updated-wins by comparing source timestamps with last target update timestamp.
- Infinite loop prevention:
  - Per-event dedupe key: `(integrationConnectionId, source, syncId)` in `SyncEventLog`.
  - Correlation ID propagated in outbound writes.
  - Ignore echo events when origin metadata indicates integration-origin write.
- Idempotency:
  - Hash mapped payload and skip writes when identical hash matches previous target hash.
- Async processing and retries:
  - BullMQ queue + worker with exponential retry/backoff.

## Feature #2: Form and Lead Capture Integration

Chosen approach: Wix forms as UI, push submissions to HubSpot.

### Capture Flow
- Receive form payload at `/webhooks/wix/form`.
- Persist minimal observability event in `LeadEvent`.
- Queue sync job to perform contact create/update in HubSpot.

### Attribution Fields Captured
- Contact data: email, first/last name, custom mapped fields.
- Source context:
  - `utm_source`
  - `utm_medium`
  - `utm_campaign`
  - `utm_term`
  - `utm_content`
  - `pageUrl`
  - `referrer`
  - `formTimestamp`

### Storage Target in HubSpot
- Attribution written as contact properties (direct fields on mapped payload).
- Mapping layer allows custom property names when needed.

## Security and Connection APIs

### OAuth + Token Lifecycle
- Dashboard endpoint starts OAuth: `GET /api/auth/hubspot/connect?siteId=...`
- Callback finalizes and stores encrypted tokens: `GET /api/auth/hubspot/callback`
- Status and disconnect:
  - `GET /api/auth/hubspot/status?siteId=...`
  - `DELETE /api/auth/hubspot/disconnect?siteId=...`

### Security Controls
- No frontend API keys.
- Dashboard APIs require bearer token (`DASHBOARD_API_TOKEN`).
- Webhook ingestion requires shared secret header (`x-integration-secret`).
- Access/refresh tokens encrypted at rest (AES-256-GCM via server key).
- Least privilege HubSpot scopes requested:
  - `crm.objects.contacts.read`
  - `crm.objects.contacts.write`
  - `crm.schemas.contacts.read`
- Safe logging policy: do not log tokens or full PII payloads.
