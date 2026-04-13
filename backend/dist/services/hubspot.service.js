"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listHubspotProperties = listHubspotProperties;
exports.upsertHubspotContact = upsertHubspotContact;
const axios_1 = __importDefault(require("axios"));
const integration_service_1 = require("./integration.service");
async function listHubspotProperties(wixSiteId) {
    const token = await (0, integration_service_1.getValidHubspotAccessToken)(wixSiteId);
    const response = await axios_1.default.get("https://api.hubapi.com/crm/v3/properties/contacts", {
        headers: { Authorization: `Bearer ${token}` },
    });
    return (response.data?.results ?? []).map((prop) => ({
        name: String(prop.name),
        label: String(prop.label ?? prop.name),
        type: String(prop.type ?? "string"),
    }));
}
async function upsertHubspotContact(params) {
    const token = await (0, integration_service_1.getValidHubspotAccessToken)(params.wixSiteId);
    if (params.hubspotContactId) {
        const updateResponse = await axios_1.default.patch(`https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(params.hubspotContactId)}`, { properties: params.properties }, {
            headers: {
                Authorization: `Bearer ${token}`,
                "x-sync-origin": "wix-integration",
                "x-correlation-id": params.correlationId,
            },
        });
        return {
            id: String(updateResponse.data.id),
            updatedAt: new Date(updateResponse.data.updatedAt ?? Date.now()),
        };
    }
    const email = params.properties.email;
    if (typeof email === "string" && email.trim()) {
        const searchResponse = await axios_1.default.post("https://api.hubapi.com/crm/v3/objects/contacts/search", {
            filterGroups: [
                {
                    filters: [{ propertyName: "email", operator: "EQ", value: email.trim() }],
                },
            ],
            limit: 1,
        }, { headers: { Authorization: `Bearer ${token}` } });
        const existing = searchResponse.data?.results?.[0];
        if (existing?.id) {
            return upsertHubspotContact({
                ...params,
                hubspotContactId: String(existing.id),
            });
        }
    }
    const createResponse = await axios_1.default.post("https://api.hubapi.com/crm/v3/objects/contacts", { properties: params.properties }, {
        headers: {
            Authorization: `Bearer ${token}`,
            "x-sync-origin": "wix-integration",
            "x-correlation-id": params.correlationId,
        },
    });
    return {
        id: String(createResponse.data.id),
        updatedAt: new Date(createResponse.data.updatedAt ?? Date.now()),
    };
}
//# sourceMappingURL=hubspot.service.js.map