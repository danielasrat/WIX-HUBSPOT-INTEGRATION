-- Assignment upgrade migration: replace legacy sync schema with robust integration schema

-- Drop legacy tables no longer used
DROP TABLE IF EXISTS "ContactMapping";
DROP TABLE IF EXISTS "HubspotToken";

-- Recreate FieldMapping with integration-scoped mapping rules
DROP TABLE IF EXISTS "FieldMapping";

CREATE TABLE "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "wixSiteId" TEXT NOT NULL,
  "hubspotPortalId" TEXT,
  "accessTokenCiphertext" TEXT NOT NULL,
  "refreshTokenCiphertext" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "disconnectedAt" TIMESTAMP(3),
  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationConnection_wixSiteId_key" ON "IntegrationConnection"("wixSiteId");
CREATE UNIQUE INDEX "IntegrationConnection_hubspotPortalId_key" ON "IntegrationConnection"("hubspotPortalId");

CREATE TABLE "OAuthState" (
  "id" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "wixSiteId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthState_state_key" ON "OAuthState"("state");

CREATE TABLE "FieldMapping" (
  "id" TEXT NOT NULL,
  "integrationConnectionId" TEXT NOT NULL,
  "wixField" TEXT NOT NULL,
  "hubspotField" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "transform" TEXT,
  "defaultValue" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldMapping_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FieldMapping_integrationConnectionId_idx" ON "FieldMapping"("integrationConnectionId");
CREATE UNIQUE INDEX "FieldMapping_integrationConnectionId_wixField_hubspotField_direction_key"
ON "FieldMapping"("integrationConnectionId", "wixField", "hubspotField", "direction");

CREATE TABLE "ContactLink" (
  "id" TEXT NOT NULL,
  "integrationConnectionId" TEXT NOT NULL,
  "wixContactId" TEXT NOT NULL,
  "hubspotContactId" TEXT NOT NULL,
  "lastWixUpdatedAt" TIMESTAMP(3),
  "lastHubspotUpdatedAt" TIMESTAMP(3),
  "lastWixHash" TEXT,
  "lastHubspotHash" TEXT,
  "lastSyncSource" TEXT NOT NULL,
  "lastSyncId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactLink_integrationConnectionId_idx" ON "ContactLink"("integrationConnectionId");
CREATE UNIQUE INDEX "ContactLink_integrationConnectionId_wixContactId_key"
ON "ContactLink"("integrationConnectionId", "wixContactId");
CREATE UNIQUE INDEX "ContactLink_integrationConnectionId_hubspotContactId_key"
ON "ContactLink"("integrationConnectionId", "hubspotContactId");

CREATE TABLE "SyncEventLog" (
  "id" TEXT NOT NULL,
  "integrationConnectionId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "syncId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncEventLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncEventLog_integrationConnectionId_expiresAt_idx"
ON "SyncEventLog"("integrationConnectionId", "expiresAt");
CREATE UNIQUE INDEX "SyncEventLog_integrationConnectionId_source_syncId_key"
ON "SyncEventLog"("integrationConnectionId", "source", "syncId");

CREATE TABLE "LeadEvent" (
  "id" TEXT NOT NULL,
  "integrationConnectionId" TEXT NOT NULL,
  "wixSubmissionId" TEXT,
  "email" TEXT,
  "pageUrl" TEXT,
  "referrer" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "utmTerm" TEXT,
  "utmContent" TEXT,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadEvent_integrationConnectionId_createdAt_idx"
ON "LeadEvent"("integrationConnectionId", "createdAt");

ALTER TABLE "FieldMapping"
ADD CONSTRAINT "FieldMapping_integrationConnectionId_fkey"
FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactLink"
ADD CONSTRAINT "ContactLink_integrationConnectionId_fkey"
FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncEventLog"
ADD CONSTRAINT "SyncEventLog_integrationConnectionId_fkey"
FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadEvent"
ADD CONSTRAINT "LeadEvent_integrationConnectionId_fkey"
FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
