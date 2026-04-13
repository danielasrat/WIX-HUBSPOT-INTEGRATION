import express from "express";
import prisma from "../utils/prisma";
import { requireDashboardAuth } from "../middleware/auth";
import { getConnectionBySiteId } from "../services/integration.service";
import { listHubspotProperties } from "../services/hubspot.service";
import { listDefaultWixFields } from "../services/wix.service";

const router = express.Router();
router.use(requireDashboardAuth);

function getSiteId(req: express.Request) {
  return String(req.query.siteId ?? req.header("x-wix-site-id") ?? req.body?.siteId ?? "").trim();
}

async function ensureConnection(siteId: string) {
  const connection = await getConnectionBySiteId(siteId);
  if (!connection) {
    throw new Error("HubSpot connection not found for this site.");
  }
  return connection;
}

router.get("/mappings/options/wix-fields", (_req, res) => {
  return res.json(
    listDefaultWixFields().map((field) => ({
      value: field,
      label: field,
    }))
  );
});

router.get("/mappings/options/hubspot-properties", async (req, res) => {
  const siteId = getSiteId(req);

  if (!siteId) {
    return res.status(400).json({ error: "siteId is required." });
  }

  try {
    const properties = await listHubspotProperties(siteId);
    return res.json(
      properties.map((property: { name: string; label: string }) => ({
        value: property.name,
        label: property.label,
      }))
    );
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load HubSpot properties.",
    });
  }
});

router.get("/mappings", async (req, res) => {
  const siteId = getSiteId(req);

  if (!siteId) {
    return res.status(400).json({ error: "siteId is required." });
  }

  const connection = await ensureConnection(siteId);
  const mappings = await prisma.fieldMapping.findMany({
    where: { integrationConnectionId: connection.id },
    orderBy: { createdAt: "asc" },
  });

  res.json(mappings);
});

router.post("/mappings", async (req, res) => {
  const siteId = getSiteId(req);
  const mappings = Array.isArray(req.body) ? req.body : [];

  if (!siteId) {
    return res.status(400).json({ error: "siteId is required." });
  }

  const connection = await ensureConnection(siteId);

  const normalized = mappings.map((mapping) => ({
    wixField: String(mapping.wixField ?? "").trim(),
    hubspotField: String(mapping.hubspotField ?? "").trim(),
    direction: String(mapping.direction ?? "bidirectional"),
    transform: mapping.transform ? String(mapping.transform) : null,
    defaultValue: mapping.defaultValue ? String(mapping.defaultValue) : null,
  }));

  const hasInvalidRow = normalized.some((m) => !m.wixField || !m.hubspotField);
  if (hasInvalidRow) {
    return res.status(400).json({ error: "Each mapping row requires Wix and HubSpot fields." });
  }

  const duplicateHubspotProps = normalized
    .filter((m) => m.direction === "bidirectional" || m.direction === "wix-to-hubspot")
    .map((m) => m.hubspotField)
    .filter((prop, index, arr) => arr.indexOf(prop) !== index);

  if (duplicateHubspotProps.length > 0) {
    return res.status(400).json({
      error: `Duplicate HubSpot property mappings are not allowed: ${[...new Set(duplicateHubspotProps)].join(", ")}`,
    });
  }

  await prisma.$transaction([
    prisma.fieldMapping.deleteMany({ where: { integrationConnectionId: connection.id } }),
    prisma.fieldMapping.createMany({
      data: normalized.map((mapping) => ({
        integrationConnectionId: connection.id,
        wixField: mapping.wixField,
        hubspotField: mapping.hubspotField,
        direction: mapping.direction,
        transform: mapping.transform,
        defaultValue: mapping.defaultValue,
      })),
    }),
  ]);

  const savedMappings = await prisma.fieldMapping.findMany({
    where: { integrationConnectionId: connection.id },
    orderBy: { createdAt: "asc" },
  });

  res.json(savedMappings);
});

export default router;
