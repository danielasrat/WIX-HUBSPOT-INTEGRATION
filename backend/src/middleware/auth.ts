import { NextFunction, Request, Response } from "express";

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.replace("Bearer ", "").trim();
}

export function requireDashboardAuth(req: Request, res: Response, next: NextFunction) {
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

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
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
