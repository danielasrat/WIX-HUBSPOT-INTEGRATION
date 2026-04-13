"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSync = processSync;
const prisma_1 = __importDefault(require("../utils/prisma"));
const crypto_1 = require("../utils/crypto");
const hubspot_service_1 = require("./hubspot.service");
const wix_service_1 = require("./wix.service");
async function processSync(data) {
    const connection = await prisma_1.default.integrationConnection.findUnique({
        where: { wixSiteId: data.wixSiteId },
    });
    if (!connection || connection.disconnectedAt) {
        return;
    }
    const dedupe = await prisma_1.default.syncEventLog.findUnique({
        where: {
            integrationConnectionId_source_syncId: {
                integrationConnectionId: connection.id,
                source: data.source,
                syncId: data.syncId,
            },
        },
    });
    if (dedupe) {
        return;
    }
    const now = new Date();
    await prisma_1.default.syncEventLog.create({
        data: {
            integrationConnectionId: connection.id,
            source: data.source,
            syncId: data.syncId,
            fingerprint: (0, crypto_1.hashObject)(data.contact),
            processedAt: now,
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
    });
    const sourceUpdatedAt = toDate(data.contact.updatedAt ?? data.contact.lastmodifieddate ?? data.occurredAt ?? now.toISOString());
    const wixContactId = readString(data.contact.id) ?? readString(data.contact.wixContactId);
    const hubspotContactId = readString(data.contact.hubspotContactId) ?? readString(data.contact.objectId) ?? readString(data.contact.id);
    const existingLink = await prisma_1.default.contactLink.findFirst({
        where: {
            integrationConnectionId: connection.id,
            OR: [
                wixContactId ? { wixContactId } : undefined,
                hubspotContactId ? { hubspotContactId } : undefined,
            ].filter(Boolean),
        },
    });
    const mappings = await prisma_1.default.fieldMapping.findMany({
        where: { integrationConnectionId: connection.id },
    });
    if (data.source === "wix") {
        const lastTargetUpdate = existingLink?.lastHubspotUpdatedAt;
        if (lastTargetUpdate && sourceUpdatedAt.getTime() < lastTargetUpdate.getTime()) {
            return;
        }
        const mapped = mapFields({ source: "wix", contact: data.contact, mappings });
        const hash = (0, crypto_1.hashObject)(mapped);
        if (existingLink?.lastHubspotHash === hash) {
            return;
        }
        const hubspotResult = await (0, hubspot_service_1.upsertHubspotContact)({
            wixSiteId: data.wixSiteId,
            properties: mapped,
            ...(existingLink?.hubspotContactId
                ? { hubspotContactId: existingLink.hubspotContactId }
                : {}),
            correlationId: data.correlationId,
        });
        await prisma_1.default.contactLink.upsert({
            where: {
                integrationConnectionId_wixContactId: {
                    integrationConnectionId: connection.id,
                    wixContactId: wixContactId ?? `wix-${hubspotResult.id}`,
                },
            },
            update: {
                hubspotContactId: hubspotResult.id,
                lastWixUpdatedAt: sourceUpdatedAt,
                lastHubspotUpdatedAt: hubspotResult.updatedAt,
                lastHubspotHash: hash,
                lastSyncSource: "wix",
                lastSyncId: data.syncId,
            },
            create: {
                integrationConnectionId: connection.id,
                wixContactId: wixContactId ?? `wix-${hubspotResult.id}`,
                hubspotContactId: hubspotResult.id,
                lastWixUpdatedAt: sourceUpdatedAt,
                lastHubspotUpdatedAt: hubspotResult.updatedAt,
                lastHubspotHash: hash,
                lastSyncSource: "wix",
                lastSyncId: data.syncId,
            },
        });
        return;
    }
    const lastTargetUpdate = existingLink?.lastWixUpdatedAt;
    if (lastTargetUpdate && sourceUpdatedAt.getTime() < lastTargetUpdate.getTime()) {
        return;
    }
    const mapped = mapFields({ source: "hubspot", contact: data.contact, mappings });
    const hash = (0, crypto_1.hashObject)(mapped);
    if (existingLink?.lastWixHash === hash) {
        return;
    }
    const wixResult = await (0, wix_service_1.upsertWixContact)({
        wixSiteId: data.wixSiteId,
        ...(existingLink?.wixContactId ? { wixContactId: existingLink.wixContactId } : {}),
        fields: mapped,
        correlationId: data.correlationId,
    });
    await prisma_1.default.contactLink.upsert({
        where: {
            integrationConnectionId_hubspotContactId: {
                integrationConnectionId: connection.id,
                hubspotContactId: hubspotContactId ?? `hs-${wixResult.id}`,
            },
        },
        update: {
            wixContactId: wixResult.id,
            lastHubspotUpdatedAt: sourceUpdatedAt,
            lastWixUpdatedAt: wixResult.updatedAt,
            lastWixHash: hash,
            lastSyncSource: "hubspot",
            lastSyncId: data.syncId,
        },
        create: {
            integrationConnectionId: connection.id,
            wixContactId: wixResult.id,
            hubspotContactId: hubspotContactId ?? `hs-${wixResult.id}`,
            lastHubspotUpdatedAt: sourceUpdatedAt,
            lastWixUpdatedAt: wixResult.updatedAt,
            lastWixHash: hash,
            lastSyncSource: "hubspot",
            lastSyncId: data.syncId,
        },
    });
}
function mapFields(params) {
    const output = {};
    for (const mapping of params.mappings) {
        if (!isDirectionAllowed(mapping.direction, params.source)) {
            continue;
        }
        const sourceField = params.source === "wix" ? mapping.wixField : mapping.hubspotField;
        const targetField = params.source === "wix" ? mapping.hubspotField : mapping.wixField;
        const raw = params.contact[sourceField];
        const base = raw ?? mapping.defaultValue ?? null;
        output[targetField] = transformValue(base, mapping.transform);
    }
    if (params.source === "wix") {
        output.utm_source = readString(params.contact.utm_source) ?? readString(params.contact["utm.source"]);
        output.utm_medium = readString(params.contact.utm_medium);
        output.utm_campaign = readString(params.contact.utm_campaign);
        output.utm_term = readString(params.contact.utm_term);
        output.utm_content = readString(params.contact.utm_content);
        output.page_url = readString(params.contact.pageUrl);
        output.referrer = readString(params.contact.referrer);
        output.form_timestamp = readString(params.contact.formTimestamp);
    }
    return removeNullish(output);
}
function transformValue(value, transform) {
    if (typeof value !== "string") {
        return value;
    }
    switch (transform) {
        case "trim":
            return value.trim();
        case "lowercase":
            return value.trim().toLowerCase();
        case "uppercase":
            return value.trim().toUpperCase();
        default:
            return value;
    }
}
function isDirectionAllowed(direction, source) {
    if (direction === "bidirectional") {
        return true;
    }
    if (source === "wix" && direction === "wix-to-hubspot") {
        return true;
    }
    return source === "hubspot" && direction === "hubspot-to-wix";
}
function toDate(value) {
    if (typeof value === "number") {
        return new Date(value);
    }
    if (typeof value === "string") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return new Date();
}
function readString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function removeNullish(data) {
    return Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
            acc[key] = value;
        }
        return acc;
    }, {});
}
//# sourceMappingURL=sync.service.js.map