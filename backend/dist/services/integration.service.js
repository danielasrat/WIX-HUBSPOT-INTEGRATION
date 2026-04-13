"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOAuthState = createOAuthState;
exports.consumeOAuthState = consumeOAuthState;
exports.exchangeCodeForToken = exchangeCodeForToken;
exports.resolveHubspotPortalId = resolveHubspotPortalId;
exports.upsertConnectionFromOAuth = upsertConnectionFromOAuth;
exports.getConnectionBySiteId = getConnectionBySiteId;
exports.getConnectionByPortalId = getConnectionByPortalId;
exports.disconnectConnection = disconnectConnection;
exports.getValidHubspotAccessToken = getValidHubspotAccessToken;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const crypto_2 = require("../utils/crypto");
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const REFRESH_BUFFER_MS = 2 * 60 * 1000;
function getOAuthConfig() {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error("HubSpot OAuth env vars are not fully configured.");
    }
    return { clientId, clientSecret, redirectUri };
}
async function createOAuthState(wixSiteId) {
    const state = crypto_1.default.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma_1.default.oAuthState.create({
        data: {
            state,
            wixSiteId,
            expiresAt,
        },
    });
    return state;
}
async function consumeOAuthState(state) {
    const record = await prisma_1.default.oAuthState.findUnique({ where: { state } });
    if (!record || record.expiresAt.getTime() < Date.now()) {
        return null;
    }
    await prisma_1.default.oAuthState.delete({ where: { state } });
    return record;
}
async function exchangeCodeForToken(code) {
    const { clientId, clientSecret, redirectUri } = getOAuthConfig();
    const response = await axios_1.default.post(HUBSPOT_TOKEN_URL, null, {
        params: {
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
        },
    });
    return response.data;
}
async function resolveHubspotPortalId(accessToken) {
    try {
        const response = await axios_1.default.get(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`);
        const hubId = response.data?.hub_id;
        return hubId ? String(hubId) : null;
    }
    catch {
        return null;
    }
}
async function upsertConnectionFromOAuth(params) {
    const tokenExpiresAt = new Date(Date.now() + params.expiresInSeconds * 1000);
    return prisma_1.default.integrationConnection.upsert({
        where: { wixSiteId: params.wixSiteId },
        update: {
            accessTokenCiphertext: (0, crypto_2.encryptSecret)(params.accessToken),
            refreshTokenCiphertext: (0, crypto_2.encryptSecret)(params.refreshToken),
            tokenExpiresAt,
            hubspotPortalId: params.hubspotPortalId,
            disconnectedAt: null,
        },
        create: {
            wixSiteId: params.wixSiteId,
            accessTokenCiphertext: (0, crypto_2.encryptSecret)(params.accessToken),
            refreshTokenCiphertext: (0, crypto_2.encryptSecret)(params.refreshToken),
            tokenExpiresAt,
            hubspotPortalId: params.hubspotPortalId,
        },
    });
}
async function getConnectionBySiteId(wixSiteId) {
    return prisma_1.default.integrationConnection.findUnique({ where: { wixSiteId } });
}
async function getConnectionByPortalId(hubspotPortalId) {
    return prisma_1.default.integrationConnection.findFirst({
        where: { hubspotPortalId, disconnectedAt: null },
    });
}
async function disconnectConnection(wixSiteId) {
    return prisma_1.default.integrationConnection.update({
        where: { wixSiteId },
        data: {
            disconnectedAt: new Date(),
        },
    });
}
async function getValidHubspotAccessToken(wixSiteId) {
    const connection = await prisma_1.default.integrationConnection.findUnique({ where: { wixSiteId } });
    if (!connection || connection.disconnectedAt) {
        throw new Error("No active HubSpot connection for this Wix site.");
    }
    const tokenExpiresSoon = connection.tokenExpiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;
    if (!tokenExpiresSoon) {
        return (0, crypto_2.decryptSecret)(connection.accessTokenCiphertext);
    }
    const refreshToken = (0, crypto_2.decryptSecret)(connection.refreshTokenCiphertext);
    const { clientId, clientSecret, redirectUri } = getOAuthConfig();
    const response = await axios_1.default.post(HUBSPOT_TOKEN_URL, null, {
        params: {
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            refresh_token: refreshToken,
        },
    });
    const { access_token, refresh_token, expires_in } = response.data;
    await prisma_1.default.integrationConnection.update({
        where: { wixSiteId },
        data: {
            accessTokenCiphertext: (0, crypto_2.encryptSecret)(access_token),
            refreshTokenCiphertext: (0, crypto_2.encryptSecret)(refresh_token ?? refreshToken),
            tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
        },
    });
    return access_token;
}
//# sourceMappingURL=integration.service.js.map