type SyncSource = "wix" | "hubspot";
type SyncJobPayload = {
    source: SyncSource;
    wixSiteId: string;
    eventType: "contact.upsert" | "form.submission";
    contact: Record<string, unknown>;
    syncId: string;
    correlationId: string;
    occurredAt?: string;
};
export declare function processSync(data: SyncJobPayload): Promise<void>;
export {};
//# sourceMappingURL=sync.service.d.ts.map