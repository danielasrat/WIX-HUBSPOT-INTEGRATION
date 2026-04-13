export declare function listDefaultWixFields(): string[];
export declare function upsertWixContact(params: {
    wixSiteId: string;
    wixContactId?: string;
    fields: Record<string, unknown>;
    correlationId: string;
}): Promise<{
    id: string;
    updatedAt: Date;
    mocked: boolean;
}>;
//# sourceMappingURL=wix.service.d.ts.map