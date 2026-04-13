import axios from "axios";

function wixConfig() {
  return {
    apiBaseUrl: process.env.WIX_CONTACTS_API_BASE_URL,
    appToken: process.env.WIX_APP_TOKEN,
  };
}

export function listDefaultWixFields() {
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

export async function upsertWixContact(params: {
  wixSiteId: string;
  wixContactId?: string;
  fields: Record<string, unknown>;
  correlationId: string;
}) {
  const { apiBaseUrl, appToken } = wixConfig();

  if (!apiBaseUrl || !appToken) {
    const fallbackId =
      params.wixContactId ??
      (typeof params.fields.email === "string" ? `mock-${params.fields.email}` : `mock-${Date.now()}`);

    return {
      id: fallbackId,
      updatedAt: new Date(),
      mocked: true,
    };
  }

  const response = await axios.post(
    `${apiBaseUrl.replace(/\/$/, "")}/contacts/upsert`,
    {
      siteId: params.wixSiteId,
      contactId: params.wixContactId,
      fields: params.fields,
    },
    {
      headers: {
        Authorization: `Bearer ${appToken}`,
        "x-correlation-id": params.correlationId,
      },
    }
  );

  return {
    id: String(response.data.id),
    updatedAt: new Date(response.data.updatedAt ?? Date.now()),
    mocked: false,
  };
}
