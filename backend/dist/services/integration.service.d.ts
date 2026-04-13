export declare function createOAuthState(wixSiteId: string): Promise<string>;
export declare function consumeOAuthState(state: string): Promise<{
    id: string;
    state: string;
    wixSiteId: string;
    expiresAt: Date;
    createdAt: Date;
} | null>;
export declare function exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
}>;
export declare function resolveHubspotPortalId(accessToken: string): Promise<string | null>;
export declare function upsertConnectionFromOAuth(params: {
    wixSiteId: string;
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    hubspotPortalId: string | null;
}): Promise<{
    id: string;
    wixSiteId: string;
    createdAt: Date;
    hubspotPortalId: string | null;
    accessTokenCiphertext: string;
    refreshTokenCiphertext: string;
    tokenExpiresAt: Date;
    updatedAt: Date;
    disconnectedAt: Date | null;
}>;
export declare function getConnectionBySiteId(wixSiteId: string): Promise<{
    id: string;
    wixSiteId: string;
    createdAt: Date;
    hubspotPortalId: string | null;
    accessTokenCiphertext: string;
    refreshTokenCiphertext: string;
    tokenExpiresAt: Date;
    updatedAt: Date;
    disconnectedAt: Date | null;
} | null>;
export declare function getConnectionByPortalId(hubspotPortalId: string): Promise<{
    id: string;
    wixSiteId: string;
    createdAt: Date;
    hubspotPortalId: string | null;
    accessTokenCiphertext: string;
    refreshTokenCiphertext: string;
    tokenExpiresAt: Date;
    updatedAt: Date;
    disconnectedAt: Date | null;
} | null>;
export declare function disconnectConnection(wixSiteId: string): Promise<{
    id: string;
    wixSiteId: string;
    createdAt: Date;
    hubspotPortalId: string | null;
    accessTokenCiphertext: string;
    refreshTokenCiphertext: string;
    tokenExpiresAt: Date;
    updatedAt: Date;
    disconnectedAt: Date | null;
}>;
export declare function getValidHubspotAccessToken(wixSiteId: string): Promise<string>;
//# sourceMappingURL=integration.service.d.ts.map