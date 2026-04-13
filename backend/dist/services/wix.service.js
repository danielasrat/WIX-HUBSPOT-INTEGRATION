"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDefaultWixFields = listDefaultWixFields;
exports.upsertWixContact = upsertWixContact;
const axios_1 = __importDefault(require("axios"));
function wixConfig() {
    return {
        apiBaseUrl: process.env.WIX_CONTACTS_API_BASE_URL,
        appToken: process.env.WIX_APP_TOKEN,
    };
}
function listDefaultWixFields() {
    return [
        "id",
        "email",
        "firstName",
        "lastName",
        "phone",
        "company",
        "jobTitle",
        "lifecycleStage",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "pageUrl",
        "referrer",
        "formTimestamp",
    ];
}
async function upsertWixContact(params) {
    const { apiBaseUrl, appToken } = wixConfig();
    if (!apiBaseUrl || !appToken) {
        const fallbackId = params.wixContactId ??
            (typeof params.fields.email === "string" ? `mock-${params.fields.email}` : `mock-${Date.now()}`);
        return {
            id: fallbackId,
            updatedAt: new Date(),
            mocked: true,
        };
    }
    const response = await axios_1.default.post(`${apiBaseUrl.replace(/\/$/, "")}/contacts/upsert`, {
        siteId: params.wixSiteId,
        contactId: params.wixContactId,
        fields: params.fields,
    }, {
        headers: {
            Authorization: `Bearer ${appToken}`,
            "x-correlation-id": params.correlationId,
        },
    });
    return {
        id: String(response.data.id),
        updatedAt: new Date(response.data.updatedAt ?? Date.now()),
        mocked: false,
    };
}
//# sourceMappingURL=wix.service.js.map