"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const integration_service_1 = require("../services/integration.service");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get("/hubspot/connect", auth_1.requireDashboardAuth, async (req, res) => {
    const wixSiteId = String(req.query.siteId ?? "").trim();
    if (!wixSiteId) {
        return res.status(400).json({ error: "siteId is required." });
    }
    const state = await (0, integration_service_1.createOAuthState)(wixSiteId);
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
    const consumedState = await (0, integration_service_1.consumeOAuthState)(state);
    if (!consumedState) {
        return res.status(400).send("State validation failed.");
    }
    const token = await (0, integration_service_1.exchangeCodeForToken)(code);
    const portalId = await (0, integration_service_1.resolveHubspotPortalId)(token.access_token);
    await (0, integration_service_1.upsertConnectionFromOAuth)({
        wixSiteId: consumedState.wixSiteId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresInSeconds: token.expires_in,
        hubspotPortalId: portalId,
    });
    return res.send("HubSpot connected successfully. You can close this tab.");
});
router.get("/hubspot/status", auth_1.requireDashboardAuth, async (req, res) => {
    const wixSiteId = String(req.query.siteId ?? "").trim();
    if (!wixSiteId) {
        return res.status(400).json({ error: "siteId is required." });
    }
    const connection = await (0, integration_service_1.getConnectionBySiteId)(wixSiteId);
    return res.json({
        connected: Boolean(connection && !connection.disconnectedAt),
        expiresAt: connection?.tokenExpiresAt ?? null,
        hubspotPortalId: connection?.hubspotPortalId ?? null,
    });
});
router.delete("/hubspot/disconnect", auth_1.requireDashboardAuth, async (req, res) => {
    const wixSiteId = String(req.query.siteId ?? "").trim();
    if (!wixSiteId) {
        return res.status(400).json({ error: "siteId is required." });
    }
    try {
        await (0, integration_service_1.disconnectConnection)(wixSiteId);
    }
    catch {
        return res.status(404).json({ error: "Integration not found." });
    }
    return res.sendStatus(204);
});
exports.default = router;
//# sourceMappingURL=auth.js.map