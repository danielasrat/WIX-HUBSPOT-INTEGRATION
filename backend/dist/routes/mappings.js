"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const auth_1 = require("../middleware/auth");
const integration_service_1 = require("../services/integration.service");
const hubspot_service_1 = require("../services/hubspot.service");
const wix_service_1 = require("../services/wix.service");
const router = express_1.default.Router();
router.use(auth_1.requireDashboardAuth);
function getSiteId(req) {
    return String(req.query.siteId ?? req.header("x-wix-site-id") ?? req.body?.siteId ?? "").trim();
}
async function ensureConnection(siteId) {
    const connection = await (0, integration_service_1.getConnectionBySiteId)(siteId);
    if (!connection) {
        throw new Error("HubSpot connection not found for this site.");
    }
    return connection;
}
router.get("/mappings/options/wix-fields", (_req, res) => {
    return res.json((0, wix_service_1.listDefaultWixFields)().map((field) => ({
        value: field,
        label: field,
    })));
});
router.get("/mappings/options/hubspot-properties", async (req, res) => {
    const siteId = getSiteId(req);
    if (!siteId) {
        return res.status(400).json({ error: "siteId is required." });
    }
    try {
        const properties = await (0, hubspot_service_1.listHubspotProperties)(siteId);
        return res.json(properties.map((property) => ({
            value: property.name,
            label: property.label,
        })));
    }
    catch (error) {
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
    const mappings = await prisma_1.default.fieldMapping.findMany({
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
    await prisma_1.default.$transaction([
        prisma_1.default.fieldMapping.deleteMany({ where: { integrationConnectionId: connection.id } }),
        prisma_1.default.fieldMapping.createMany({
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
    const savedMappings = await prisma_1.default.fieldMapping.findMany({
        where: { integrationConnectionId: connection.id },
        orderBy: { createdAt: "asc" },
    });
    res.json(savedMappings);
});
exports.default = router;
//# sourceMappingURL=mappings.js.map