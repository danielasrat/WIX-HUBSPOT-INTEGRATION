# Testing Guide

## Prerequisites
- Backend API running on `http://localhost:5000`
- Worker process running
- Frontend dashboard running on `http://localhost:3000`
- Redis + Postgres available
- Valid env configured (see README)

## 1) OAuth Connection Flow
1. Open dashboard.
2. Set `siteId` and click Connect HubSpot.
3. Complete OAuth in HubSpot.
4. Verify status endpoint:

```bash
curl -H "Authorization: Bearer <DASHBOARD_API_TOKEN>" \
  "http://localhost:5000/api/auth/hubspot/status?siteId=demo-site"
```

Expected:
- `connected: true`
- `expiresAt` populated

## 2) Mapping CRUD + Validation
1. In dashboard, create mappings and save.
2. Verify persistence:

```bash
curl -H "Authorization: Bearer <DASHBOARD_API_TOKEN>" \
  "http://localhost:5000/api/mappings?siteId=demo-site"
```

Expected:
- Saved rows returned in order.
- Duplicate HubSpot property mapping should return `400`.

## 3) Wix -> HubSpot Contact Create/Update

```bash
curl -X POST "http://localhost:5000/webhooks/wix/contact?siteId=demo-site" \
  -H "Content-Type: application/json" \
  -H "x-integration-secret: <WEBHOOK_SHARED_SECRET>" \
  -H "x-sync-id: wix-contact-1" \
  -d "{\"id\":\"wix-100\",\"email\":\"lead@example.com\",\"firstName\":\"Ada\",\"lastName\":\"Lovelace\",\"updatedAt\":\"2026-04-13T12:00:00.000Z\"}"
```

Expected:
- HTTP `200`.
- Worker processes upsert to HubSpot.
- `ContactLink` row is created/updated.

## 4) HubSpot -> Wix Contact Update

```bash
curl -X POST "http://localhost:5000/webhooks/hubspot" \
  -H "Content-Type: application/json" \
  -H "x-integration-secret: <WEBHOOK_SHARED_SECRET>" \
  -d "[{\"eventId\":\"hs-evt-1\",\"portalId\":\"<PORTAL_ID>\",\"occurredAt\":\"2026-04-13T12:05:00.000Z\",\"properties\":{\"id\":\"201\",\"email\":\"lead@example.com\",\"firstname\":\"Ada\",\"lastname\":\"Byron\",\"lastmodifieddate\":\"2026-04-13T12:05:00.000Z\"}}]"
```

Expected:
- HTTP `200`.
- Worker maps HubSpot -> Wix and calls Wix upsert service.

## 5) Loop Prevention + Idempotency
1. Replay the exact same payload with same `x-sync-id`.
2. Replay same content with a new `x-sync-id`.

Expected:
- First replay: deduped by sync event log.
- Second replay: skipped by hash idempotency check (no unnecessary rewrite).

## 6) Wix Form Submission With UTM Attribution

```bash
curl -X POST "http://localhost:5000/webhooks/wix/form?siteId=demo-site" \
  -H "Content-Type: application/json" \
  -H "x-integration-secret: <WEBHOOK_SHARED_SECRET>" \
  -d "{\"submissionId\":\"sub-1\",\"email\":\"lead@example.com\",\"firstName\":\"Ada\",\"utm_source\":\"google\",\"utm_medium\":\"cpc\",\"utm_campaign\":\"spring_launch\",\"pageUrl\":\"https://example.com/pricing\",\"referrer\":\"https://google.com\",\"formTimestamp\":\"2026-04-13T12:10:00.000Z\"}"
```

Expected:
- HTTP `200`.
- `LeadEvent` record created.
- Contact updated in HubSpot with attribution properties.

## 7) Disconnect

```bash
curl -X DELETE -H "Authorization: Bearer <DASHBOARD_API_TOKEN>" \
  "http://localhost:5000/api/auth/hubspot/disconnect?siteId=demo-site"
```

Expected:
- HTTP `204`.
- Status returns `connected: false`.
