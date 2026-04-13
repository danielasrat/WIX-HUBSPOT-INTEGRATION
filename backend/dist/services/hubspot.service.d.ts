export declare function listHubspotProperties(wixSiteId: string): Promise<any>;
export declare function upsertHubspotContact(params: {
    wixSiteId: string;
    properties: Record<string, unknown>;
    hubspotContactId?: string;
    correlationId: string;
}): Promise<{
    id: string;
    updatedAt: Date;
}>;
//# sourceMappingURL=hubspot.service.d.ts.map