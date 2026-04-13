import axios from "axios";
import crypto from "crypto";
import prisma from "../utils/prisma";
import { decryptSecret, encryptSecret } from "../utils/crypto";

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

export async function createOAuthState(wixSiteId: string) {
  const state = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.oAuthState.create({
    data: {
      state,
      wixSiteId,
      expiresAt,
    },
  });

  return state;
}

export async function consumeOAuthState(state: string) {
  const record = await prisma.oAuthState.findUnique({ where: { state } });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    return null;
  }

  await prisma.oAuthState.delete({ where: { state } });
  return record;
}

export async function exchangeCodeForToken(code: string) {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();

  const response = await axios.post(HUBSPOT_TOKEN_URL, null, {
    params: {
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    },
  });

  return response.data as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export async function resolveHubspotPortalId(accessToken: string): Promise<string | null> {
  try {
    const response = await axios.get(
      `https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`
    );

    const hubId = response.data?.hub_id;
    return hubId ? String(hubId) : null;
  } catch {
    return null;
  }
}

export async function upsertConnectionFromOAuth(params: {
  wixSiteId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  hubspotPortalId: string | null;
}) {
  const tokenExpiresAt = new Date(Date.now() + params.expiresInSeconds * 1000);

  return prisma.integrationConnection.upsert({
    where: { wixSiteId: params.wixSiteId },
    update: {
      accessTokenCiphertext: encryptSecret(params.accessToken),
      refreshTokenCiphertext: encryptSecret(params.refreshToken),
      tokenExpiresAt,
      hubspotPortalId: params.hubspotPortalId,
      disconnectedAt: null,
    },
    create: {
      wixSiteId: params.wixSiteId,
      accessTokenCiphertext: encryptSecret(params.accessToken),
      refreshTokenCiphertext: encryptSecret(params.refreshToken),
      tokenExpiresAt,
      hubspotPortalId: params.hubspotPortalId,
    },
  });
}

export async function getConnectionBySiteId(wixSiteId: string) {
  return prisma.integrationConnection.findUnique({ where: { wixSiteId } });
}

export async function getConnectionByPortalId(hubspotPortalId: string) {
  return prisma.integrationConnection.findFirst({
    where: { hubspotPortalId, disconnectedAt: null },
  });
}

export async function disconnectConnection(wixSiteId: string) {
  return prisma.integrationConnection.update({
    where: { wixSiteId },
    data: {
      disconnectedAt: new Date(),
    },
  });
}

export async function getValidHubspotAccessToken(wixSiteId: string): Promise<string> {
  const connection = await prisma.integrationConnection.findUnique({ where: { wixSiteId } });

  if (!connection || connection.disconnectedAt) {
    throw new Error("No active HubSpot connection for this Wix site.");
  }

  const tokenExpiresSoon = connection.tokenExpiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;
  if (!tokenExpiresSoon) {
    return decryptSecret(connection.accessTokenCiphertext);
  }

  const refreshToken = decryptSecret(connection.refreshTokenCiphertext);
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();

  const response = await axios.post(HUBSPOT_TOKEN_URL, null, {
    params: {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      refresh_token: refreshToken,
    },
  });

  const { access_token, refresh_token, expires_in } = response.data as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await prisma.integrationConnection.update({
    where: { wixSiteId },
    data: {
      accessTokenCiphertext: encryptSecret(access_token),
      refreshTokenCiphertext: encryptSecret(refresh_token ?? refreshToken),
      tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
    },
  });

  return access_token;
}
