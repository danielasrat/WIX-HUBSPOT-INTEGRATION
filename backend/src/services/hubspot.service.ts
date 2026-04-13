import axios from "axios";
import { getValidHubspotAccessToken } from "./integration.service";

export async function listHubspotProperties(wixSiteId: string) {
  const token = await getValidHubspotAccessToken(wixSiteId);
  const response = await axios.get("https://api.hubapi.com/crm/v3/properties/contacts", {
    headers: { Authorization: `Bearer ${token}` },
  });

  return (response.data?.results ?? []).map((prop: any) => ({
    name: String(prop.name),
    label: String(prop.label ?? prop.name),
    type: String(prop.type ?? "string"),
  }));
}

export async function upsertHubspotContact(params: {
  wixSiteId: string;
  properties: Record<string, unknown>;
  hubspotContactId?: string;
  correlationId: string;
}) {
  const token = await getValidHubspotAccessToken(params.wixSiteId);

  if (params.hubspotContactId) {
    const updateResponse = await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(params.hubspotContactId)}`,
      { properties: params.properties },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-sync-origin": "wix-integration",
          "x-correlation-id": params.correlationId,
        },
      }
    );

    return {
      id: String(updateResponse.data.id),
      updatedAt: new Date(updateResponse.data.updatedAt ?? Date.now()),
    };
  }

  const email = params.properties.email;
  if (typeof email === "string" && email.trim()) {
    const searchResponse = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        filterGroups: [
          {
            filters: [{ propertyName: "email", operator: "EQ", value: email.trim() }],
          },
        ],
        limit: 1,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const existing = searchResponse.data?.results?.[0];
    if (existing?.id) {
      return upsertHubspotContact({
        ...params,
        hubspotContactId: String(existing.id),
      });
    }
  }

  const createResponse = await axios.post(
    "https://api.hubapi.com/crm/v3/objects/contacts",
    { properties: params.properties },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-sync-origin": "wix-integration",
        "x-correlation-id": params.correlationId,
      },
    }
  );

  return {
    id: String(createResponse.data.id),
    updatedAt: new Date(createResponse.data.updatedAt ?? Date.now()),
  };
}
