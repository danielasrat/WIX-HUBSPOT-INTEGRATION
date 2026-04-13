-- CreateTable
CREATE TABLE "HubspotToken" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubspotToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMapping" (
    "id" TEXT NOT NULL,
    "wixContactId" TEXT NOT NULL,
    "hubspotContactId" TEXT NOT NULL,
    "lastSyncSource" TEXT NOT NULL,
    "syncId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldMapping" (
    "id" TEXT NOT NULL,
    "wixField" TEXT NOT NULL,
    "hubspotField" TEXT NOT NULL,
    "direction" TEXT NOT NULL,

    CONSTRAINT "FieldMapping_pkey" PRIMARY KEY ("id")
);
