import { useEffect, useState } from "react";

const createEmptyMapping = () => ({
  wixField: "",
  hubspotField: "",
  direction: "bidirectional",
  transform: "",
  defaultValue: "",
});

const dashboardToken = import.meta.env.VITE_DASHBOARD_API_TOKEN ?? "";

const transformOptions = [
  { value: "", label: "None" },
  { value: "trim", label: "Trim" },
  { value: "lowercase", label: "Lowercase" },
  { value: "uppercase", label: "Uppercase" },
];

export default function App() {
  const [siteId, setSiteId] = useState(import.meta.env.VITE_WIX_SITE_ID ?? "demo-site");
  const [connection, setConnection] = useState({ connected: false, expiresAt: null, hubspotPortalId: null });
  const [mappings, setMappings] = useState([createEmptyMapping()]);
  const [wixFields, setWixFields] = useState([]);
  const [hubspotFields, setHubspotFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void bootstrap();
  }, [siteId]);

  const bootstrap = async () => {
    setLoading(true);
    setStatus("");

    try {
      await Promise.all([loadConnection(), loadWixFields(), loadHubspotFields(), loadMappings()]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  const apiFetch = async (url, options = {}) => {
    const headers = new Headers(options.headers ?? {});
    headers.set("Content-Type", "application/json");

    if (dashboardToken) {
      headers.set("Authorization", `Bearer ${dashboardToken}`);
    }

    headers.set("x-wix-site-id", siteId);

    return fetch(url, {
      ...options,
      headers,
    });
  };

  const loadConnection = async () => {
    const response = await apiFetch(`/api/auth/hubspot/status?siteId=${encodeURIComponent(siteId)}`);

    if (!response.ok) {
      throw new Error("Unable to load HubSpot connection status.");
    }

    setConnection(await response.json());
  };

  const connectHubspot = async () => {
    const response = await apiFetch(`/api/auth/hubspot/connect?siteId=${encodeURIComponent(siteId)}`);

    if (!response.ok) {
      throw new Error("Unable to start HubSpot OAuth flow.");
    }

    const data = await response.json();
    window.location.href = data.url;
  };

  const disconnectHubspot = async () => {
    const response = await apiFetch(`/api/auth/hubspot/disconnect?siteId=${encodeURIComponent(siteId)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Unable to disconnect HubSpot.");
    }

    setStatus("Disconnected HubSpot account.");
    await bootstrap();
  };

  const loadWixFields = async () => {
    const response = await apiFetch("/api/mappings/options/wix-fields");

    if (!response.ok) {
      throw new Error("Unable to load Wix fields.");
    }

    setWixFields(await response.json());
  };

  const loadHubspotFields = async () => {
    const response = await apiFetch(
      `/api/mappings/options/hubspot-properties?siteId=${encodeURIComponent(siteId)}`
    );

    if (!response.ok) {
      setHubspotFields([]);
      return;
    }

    setHubspotFields(await response.json());
  };

  const loadMappings = async () => {
    try {
      const response = await apiFetch(`/api/mappings?siteId=${encodeURIComponent(siteId)}`);

      if (!response.ok) {
        throw new Error("Unable to load saved mappings.");
      }

      const data = await response.json();
      setMappings(data.length > 0 ? data : [createEmptyMapping()]);
      setStatus("Loaded saved mappings.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load mappings.");
    }
  };

  const updateMapping = (index, field, value) => {
    setMappings((currentMappings) =>
      currentMappings.map((mapping, mappingIndex) =>
        mappingIndex === index ? { ...mapping, [field]: value } : mapping
      )
    );
  };

  const addMapping = () => {
    setMappings((currentMappings) => [...currentMappings, createEmptyMapping()]);
  };

  const removeMapping = (index) => {
    setMappings((currentMappings) => {
      if (currentMappings.length === 1) {
        return [createEmptyMapping()];
      }

      return currentMappings.filter((_, mappingIndex) => mappingIndex !== index);
    });
  };

  const save = async () => {
    try {
      setSaving(true);
      setStatus("");

      const duplicateHubspotProps = mappings
        .filter((mapping) =>
          ["bidirectional", "wix-to-hubspot"].includes(mapping.direction)
        )
        .map((mapping) => mapping.hubspotField)
        .filter((value, index, arr) => value && arr.indexOf(value) !== index);

      if (duplicateHubspotProps.length > 0) {
        throw new Error(`Duplicate HubSpot property mappings: ${[...new Set(duplicateHubspotProps)].join(", ")}`);
      }

      const response = await apiFetch(`/api/mappings?siteId=${encodeURIComponent(siteId)}`, {
        method: "POST",
        body: JSON.stringify(mappings),
      });

      if (!response.ok) {
        throw new Error("Unable to save mappings.");
      }

      const savedMappings = await response.json();
      setMappings(savedMappings.length > 0 ? savedMappings : [createEmptyMapping()]);
      setStatus("Saved successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save mappings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="panel">
        <header className="hero">
          <p className="eyebrow">Wix + HubSpot integration</p>
          <h1>Connection + mapping studio</h1>
          <p>
            Configure OAuth, property mappings, sync direction, and optional transforms that power
            bi-directional contact sync.
          </p>
        </header>

        <div className="connection-bar">
          <label>
            Wix site ID
            <input value={siteId} onChange={(event) => setSiteId(event.target.value)} />
          </label>
          <div className="connection-status">
            <span className={`badge ${connection.connected ? "connected" : "disconnected"}`}>
              {connection.connected ? "Connected" : "Not connected"}
            </span>
            {connection.expiresAt ? <span>Token expires: {new Date(connection.expiresAt).toLocaleString()}</span> : null}
            {connection.hubspotPortalId ? <span>Portal: {connection.hubspotPortalId}</span> : null}
          </div>
          <div className="actions">
            <button className="button secondary" type="button" onClick={connectHubspot}>
              Connect HubSpot
            </button>
            <button className="button secondary" type="button" onClick={disconnectHubspot}>
              Disconnect
            </button>
          </div>
        </div>

        <div className="toolbar">
          <p className={`status ${status.includes("Failed") || status.includes("Unable") ? "error" : ""}`}>
            {status || `Configure ${mappings.length} mapping${mappings.length === 1 ? "" : "s"}.`}
          </p>

          <div className="actions">
            <button className="button secondary" type="button" onClick={loadMappings} disabled={loading || saving}>
              Refresh
            </button>
            <button className="button secondary" type="button" onClick={addMapping} disabled={saving}>
              Add mapping
            </button>
            <button className="button primary" type="button" onClick={save} disabled={loading || saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="skeleton" aria-hidden="true">
            <div className="skeleton-bar" />
            <div className="skeleton-bar" />
          </div>
        ) : (
          <div className="list">
            {mappings.map((mapping, index) => (
              <div className="mapping-card" key={`${mapping.wixField}-${index}`}>
                <select
                  value={mapping.wixField}
                  onChange={(event) => updateMapping(index, "wixField", event.target.value)}
                >
                  <option value="">Select Wix field</option>
                  {wixFields.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
                <select
                  value={mapping.hubspotField}
                  onChange={(event) => updateMapping(index, "hubspotField", event.target.value)}
                >
                  <option value="">Select HubSpot property</option>
                  {hubspotFields.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
                <select
                  value={mapping.direction}
                  onChange={(event) => updateMapping(index, "direction", event.target.value)}
                >
                  <option value="bidirectional">Bidirectional</option>
                  <option value="wix-to-hubspot">Wix to HubSpot</option>
                  <option value="hubspot-to-wix">HubSpot to Wix</option>
                </select>
                <select
                  value={mapping.transform ?? ""}
                  onChange={(event) => updateMapping(index, "transform", event.target.value)}
                >
                  {transformOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Default value (optional)"
                  value={mapping.defaultValue ?? ""}
                  onChange={(event) => updateMapping(index, "defaultValue", event.target.value)}
                />
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => removeMapping(index)}
                  aria-label={`Remove mapping ${index + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}