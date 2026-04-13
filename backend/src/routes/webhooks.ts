import express from "express";
import { getSyncQueue } from "../jobs/queue";
import prisma from "../utils/prisma";
import { requireWebhookSecret } from "../middleware/auth";
import { getConnectionByPortalId, getConnectionBySiteId } from "../services/integration.service";

const router = express.Router();
router.use(requireWebhookSecret);

function correlationId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function readSiteId(req: express.Request) {
  return String(req.query.siteId ?? req.body?.siteId ?? req.header("x-wix-site-id") ?? "").trim();
}

async function enqueueSyncJob(payload: {
  source: "wix" | "hubspot";
  wixSiteId: string;
  eventType: "contact.upsert" | "form.submission";
  contact: Record<string, unknown>;
  syncId: string;
  correlationId: string;
  occurredAt?: string;
}) {
  try {
    await getSyncQueue().add("sync", payload, {
      attempts: 5,
      removeOnComplete: 1000,
      removeOnFail: 2000,
      backoff: { type: "exponential", delay: 2000 },
    });
    return true;
  } catch (error) {
    console.error("Failed to enqueue sync job", error);
    return false;
  }
}

// Wix → HubSpot
router.post("/wix/contact", async (req, res) => {
  const wixSiteId = readSiteId(req);
  if (!wixSiteId) {
    return res.status(400).json({ error: "siteId is required." });
  }

  const connection = await getConnectionBySiteId(wixSiteId);
  if (!connection || connection.disconnectedAt) {
    return res.status(404).json({ error: "No active integration for this site." });
  }

  const added = await enqueueSyncJob({
    source: "wix",
    wixSiteId,
    eventType: "contact.upsert",
    contact: req.body,
    syncId: String(req.body.syncId ?? req.header("x-sync-id") ?? correlationId()),
    correlationId: String(req.header("x-correlation-id") ?? correlationId()),
    occurredAt: String(req.body.updatedAt ?? new Date().toISOString()),
  });

  if (!added) {
    return res.status(503).json({
      error: "Queue unavailable. Ensure Redis is running.",
    });
  }

  res.sendStatus(200);
});

// Wix Form → HubSpot
router.post("/wix/form", async (req, res) => {
  const wixSiteId = readSiteId(req);
  if (!wixSiteId) {
    return res.status(400).json({ error: "siteId is required." });
  }

  const connection = await getConnectionBySiteId(wixSiteId);
  if (!connection || connection.disconnectedAt) {
    return res.status(404).json({ error: "No active integration for this site." });
  }

  await prisma.leadEvent.create({
    data: {
      integrationConnectionId: connection.id,
      wixSubmissionId: String(req.body.submissionId ?? "") || null,
      email: typeof req.body.email === "string" ? req.body.email : null,
      pageUrl: typeof req.body.pageUrl === "string" ? req.body.pageUrl : null,
      referrer: typeof req.body.referrer === "string" ? req.body.referrer : null,
      utmSource: typeof req.body.utm_source === "string" ? req.body.utm_source : null,
      utmMedium: typeof req.body.utm_medium === "string" ? req.body.utm_medium : null,
      utmCampaign: typeof req.body.utm_campaign === "string" ? req.body.utm_campaign : null,
      utmTerm: typeof req.body.utm_term === "string" ? req.body.utm_term : null,
      utmContent: typeof req.body.utm_content === "string" ? req.body.utm_content : null,
      payload: req.body,
    },
  });

  const added = await enqueueSyncJob({
    source: "wix",
    wixSiteId,
    eventType: "form.submission",
    contact: req.body,
    syncId: String(req.body.syncId ?? req.header("x-sync-id") ?? correlationId()),
    correlationId: String(req.header("x-correlation-id") ?? correlationId()),
    occurredAt: String(req.body.formTimestamp ?? new Date().toISOString()),
  });

  if (!added) {
    return res.status(503).json({
      error: "Queue unavailable. Ensure Redis is running.",
    });
  }

  res.sendStatus(200);
});

// HubSpot → Wix
router.post("/hubspot", async (req, res) => {
  const events = Array.isArray(req.body) ? req.body : [];

  for (const event of events) {
    const portalId = String(event.portalId ?? "");
    if (!portalId) {
      continue;
    }

    const connection = await getConnectionByPortalId(portalId);
    if (!connection) {
      continue;
    }

    // Ignore webhook echoes from our own writes when correlation metadata is present.
    if (String(event.origin ?? "").toLowerCase() === "wix-integration") {
      continue;
    }

    const added = await enqueueSyncJob({
      source: "hubspot",
      wixSiteId: connection.wixSiteId,
      eventType: "contact.upsert",
      contact: event.properties ?? event,
      syncId: String(event.eventId ?? event.subscriptionId ?? correlationId()),
      correlationId: String(event.correlationId ?? correlationId()),
      occurredAt: String(event.occurredAt ?? new Date().toISOString()),
    });

    if (!added) {
      return res.status(503).json({
        error: "Queue unavailable. Ensure Redis is running.",
      });
    }
  }

  res.sendStatus(200);
});

export default router;