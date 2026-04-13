"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireDashboardAuth = requireDashboardAuth;
exports.requireWebhookSecret = requireWebhookSecret;
function bearerToken(req) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return null;
    }
    return header.replace("Bearer ", "").trim();
}
function requireDashboardAuth(req, res, next) {
    const expected = process.env.DASHBOARD_API_TOKEN;
    if (!expected) {
        return res.status(500).json({ error: "Missing DASHBOARD_API_TOKEN configuration." });
    }
    const token = bearerToken(req);
    if (!token || token !== expected) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    return next();
}
function requireWebhookSecret(req, res, next) {
    const expected = process.env.WEBHOOK_SHARED_SECRET;
    if (!expected) {
        return res.status(500).json({ error: "Missing WEBHOOK_SHARED_SECRET configuration." });
    }
    const provided = req.header("x-integration-secret")?.trim();
    if (!provided || provided !== expected) {
        return res.status(401).json({ error: "Invalid webhook secret." });
    }
    return next();
}
//# sourceMappingURL=auth.js.map