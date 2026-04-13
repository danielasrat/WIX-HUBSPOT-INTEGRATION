import express from "express";
import {
  consumeOAuthState,
  createOAuthState,
  disconnectConnection,
  exchangeCodeForToken,
  getConnectionBySiteId,
  resolveHubspotPortalId,
  upsertConnectionFromOAuth,
} from "../services/integration.service";
import { requireDashboardAuth } from "../middleware/auth";

const router = express.Router();

router.get("/hubspot/connect", requireDashboardAuth, async (req, res) => {
  const wixSiteId = String(req.query.siteId ?? "").trim();

  if (!wixSiteId) {
    return res.status(400).json({ error: "siteId is required." });
  }

  const state = await createOAuthState(wixSiteId);
  const scopes = [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.schemas.contacts.read",
  ].join(" ");

  const url = new URL("https://app.hubspot.com/oauth/authorize");
  url.searchParams.set("client_id", process.env.HUBSPOT_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", process.env.HUBSPOT_REDIRECT_URI ?? "");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);

  return res.json({ url: url.toString() });
});

router.get("/hubspot/callback", async (req, res) => {
  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");

  if (!code || !state) {
    return res.status(400).send("Missing OAuth code or state.");
  }

  const consumedState = await consumeOAuthState(state);
  if (!consumedState) {
    return res.status(400).send("State validation failed.");
  }

  const token = await exchangeCodeForToken(code);
  const portalId = await resolveHubspotPortalId(token.access_token);

  await upsertConnectionFromOAuth({
    wixSiteId: consumedState.wixSiteId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresInSeconds: token.expires_in,
    hubspotPortalId: portalId,
  });

  return res.send("HubSpot connected successfully. You can close this tab.");
});

router.get("/hubspot/status", requireDashboardAuth, async (req, res) => {
  const wixSiteId = String(req.query.siteId ?? "").trim();

  if (!wixSiteId) {
    return res.status(400).json({ error: "siteId is required." });
  }

  const connection = await getConnectionBySiteId(wixSiteId);
  return res.json({
    connected: Boolean(connection && !connection.disconnectedAt),
    expiresAt: connection?.tokenExpiresAt ?? null,
    hubspotPortalId: connection?.hubspotPortalId ?? null,
  });
});

router.delete("/hubspot/disconnect", requireDashboardAuth, async (req, res) => {
  const wixSiteId = String(req.query.siteId ?? "").trim();

  if (!wixSiteId) {
    return res.status(400).json({ error: "siteId is required." });
  }

  try {
    await disconnectConnection(wixSiteId);
  } catch {
    return res.status(404).json({ error: "Integration not found." });
  }

  return res.sendStatus(204);
});

export default router;