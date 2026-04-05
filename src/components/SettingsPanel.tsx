import { useEffect, useState } from "react";
import type { EnvironmentDomain, EnvironmentSettings, ImportedEnvironmentValues } from "../types";
import type { EnvironmentRequirement } from "../lib/environmentRequirements";

function getEnvironmentDomains(settings: EnvironmentSettings) {
  return settings.domains ?? [];
}

type EnvironmentValueRow = {
  id: string;
  key: string;
  value: string;
};

let domainIdCounter = 0;
let valueRowIdCounter = 0;

function createEnvironmentValueRow(entry?: { key: string; value: string }): EnvironmentValueRow {
  valueRowIdCounter += 1;
  return {
    id: `env-row-${valueRowIdCounter}`,
    key: entry?.key ?? "",
    value: entry?.value ?? "",
  };
}

function toEnvironmentValueRows(values: Array<{ key: string; value: string }> | undefined): EnvironmentValueRow[] {
  const rows = (values ?? []).map((entry) => createEnvironmentValueRow(entry));
  return rows.length > 0 ? rows : [createEnvironmentValueRow()];
}

function toEnvironmentDomainValues(rows: EnvironmentValueRow[]) {
  const deduped = new Map<string, string>();

  for (const row of rows) {
    const key = row.key.trim();
    if (key.length === 0) {
      continue;
    }
    deduped.set(key, row.value);
  }

  return [...deduped.entries()].map(([key, value]) => ({ key, value }));
}

function getDuplicateEnvironmentKeys(rows: EnvironmentValueRow[]) {
  const seenKeys = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    const key = row.key.trim();
    if (key.length === 0) {
      continue;
    }

    if (seenKeys.has(key)) {
      duplicates.add(key);
      continue;
    }

    seenKeys.add(key);
  }

  return [...duplicates].sort((left, right) => left.localeCompare(right));
}

function normalizeMatchHost(value: string) {
  return value.trim().toLowerCase();
}

function createNextDomainId(domains: EnvironmentDomain[]) {
  const existingIds = new Set(domains.map((domain) => domain.id));

  do {
    domainIdCounter += 1;
  } while (existingIds.has(`domain-${domainIdCounter}`));

  return `domain-${domainIdCounter}`;
}

function createNextEnvironmentLabel(domains: EnvironmentDomain[]) {
  const existingNames = new Set(domains.map((domain) => domain.name.trim().toUpperCase()));

  if (!existingNames.has("LOCAL_ENV")) {
    return "LOCAL_ENV";
  }

  let index = 2;
  while (existingNames.has(`LOCAL_ENV_${index}`)) {
    index += 1;
  }

  return `LOCAL_ENV_${index}`;
}

type SettingsSection = "environment" | "story-data";

interface SettingsPanelProps {
  requirements: EnvironmentRequirement[];
  environmentSettings: EnvironmentSettings;
  environmentSettingsError: string | null;
  onSaveEnvironmentSettings: (settings: EnvironmentSettings) => Promise<void>;
  onImportEnvironmentFile: () => Promise<ImportedEnvironmentValues | null>;
  onTriggerExportStories: () => void;
  onTriggerImportStories: () => void;
}

export function SettingsPanel({
  environmentSettings,
  environmentSettingsError,
  onSaveEnvironmentSettings,
  onImportEnvironmentFile,
  onTriggerExportStories,
  onTriggerImportStories,
}: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("environment");
  const domains = getEnvironmentDomains(environmentSettings);
  const canAddEnvironment = domains.length < 10;
  const configuredValueCount = domains.reduce((count, domain) => count + (domain.values?.length ?? 0), 0);
  const [activeTabId, setActiveTabId] = useState(environmentSettings.activeDomainId ?? domains[0]?.id);
  const activeDomain = domains.find((domain) => domain.id === activeTabId) ?? domains[0] ?? null;
  const envValuesKey = JSON.stringify(activeDomain?.values ?? []);
  const [domainNameDraft, setDomainNameDraft] = useState(activeDomain?.name ?? "");
  const [matchHostDraft, setMatchHostDraft] = useState(activeDomain?.matchHost ?? "");
  const [environmentValueRows, setEnvironmentValueRows] = useState<EnvironmentValueRow[]>(
    toEnvironmentValueRows(activeDomain?.values),
  );
  const [importError, setImportError] = useState<string | null>(null);
  const duplicateKeys = getDuplicateEnvironmentKeys(environmentValueRows);
  const savedValueRows = toEnvironmentValueRows(activeDomain?.values);
  const normalizedDraftDomainName = domainNameDraft.trim();
  const normalizedMatchHostDraft = normalizeMatchHost(matchHostDraft);
  const savedDomainName = activeDomain?.name ?? "";
  const savedMatchHost = activeDomain?.matchHost ?? "";
  const hasPendingDomainNameChange =
    activeDomain !== null && normalizedDraftDomainName.length > 0 && normalizedDraftDomainName !== savedDomainName;
  const hasPendingMatchHostChange = activeDomain !== null && normalizedMatchHostDraft !== savedMatchHost;
  const hasPendingValueChanges =
    JSON.stringify(toEnvironmentDomainValues(environmentValueRows)) !== JSON.stringify(toEnvironmentDomainValues(savedValueRows));
  const hasPendingActiveTabChange = activeTabId !== environmentSettings.activeDomainId;

  function saveDomains(nextDomains: typeof domains, nextActiveTabId = activeTabId ?? nextDomains[0]?.id) {
    setActiveTabId(nextActiveTabId);
    return onSaveEnvironmentSettings({
      domains: nextDomains,
      activeDomainId: nextActiveTabId,
    });
  }

  function updateActiveDomain(next: {
    name?: string;
    matchHost?: string;
    values?: Record<string, string> | Array<{ key: string; value: string }>;
  }) {
    if (!activeDomain) return Promise.resolve();
    const nextDomains = domains.map((domain) => {
      if (domain.id !== activeDomain.id) return domain;
      const nextValues = Array.isArray(next.values)
        ? next.values
        : next.values
          ? Object.entries(next.values).map(([key, value]) => ({ key, value }))
          : undefined;

      return {
        ...domain,
        ...(typeof next.name === "string" ? { name: next.name } : {}),
        ...(typeof next.matchHost === "string" ? { matchHost: next.matchHost } : {}),
        ...(nextValues ? { values: nextValues } : {}),
      };
    });
    return saveDomains(nextDomains, activeDomain.id);
  }

  function updateEnvironmentValueRow(rowId: string, field: "key" | "value", nextValue: string) {
    setEnvironmentValueRows((previousRows) =>
      previousRows.map((row) => (row.id === rowId ? { ...row, [field]: nextValue } : row)),
    );
  }

  function addEnvironmentValueRow() {
    setEnvironmentValueRows((previousRows) => [...previousRows, createEnvironmentValueRow()]);
  }

  function removeEnvironmentValueRow(rowId: string) {
    setEnvironmentValueRows((previousRows) => {
      const nextRows = previousRows.filter((row) => row.id !== rowId);
      return nextRows.length > 0 ? nextRows : [createEnvironmentValueRow()];
    });
  }

  useEffect(() => {
    setDomainNameDraft(activeDomain?.name ?? "");
    setMatchHostDraft(activeDomain?.matchHost ?? "");
    setImportError(null);
  }, [activeDomain?.id, activeDomain?.matchHost, activeDomain?.name]);

  useEffect(() => {
    setEnvironmentValueRows(toEnvironmentValueRows(activeDomain?.values));
  }, [envValuesKey]);

  useEffect(() => {
    if (!activeDomain) {
      return;
    }

    const hasPendingEdits = hasPendingDomainNameChange || hasPendingMatchHostChange || (hasPendingValueChanges && duplicateKeys.length === 0);

    if (!hasPendingEdits && !hasPendingActiveTabChange) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (hasPendingEdits) {
        void updateActiveDomain({
          ...(hasPendingDomainNameChange ? { name: normalizedDraftDomainName } : {}),
          ...(hasPendingMatchHostChange ? { matchHost: normalizedMatchHostDraft } : {}),
          ...(hasPendingValueChanges && duplicateKeys.length === 0
            ? { values: toEnvironmentDomainValues(environmentValueRows) }
            : {}),
        });
      } else {
        void onSaveEnvironmentSettings({ domains, activeDomainId: activeTabId });
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeDomain,
    activeTabId,
    duplicateKeys.length,
    environmentValueRows,
    hasPendingActiveTabChange,
    hasPendingDomainNameChange,
    hasPendingMatchHostChange,
    hasPendingValueChanges,
    normalizedMatchHostDraft,
    normalizedDraftDomainName,
  ]);

  return (
    <section className="settings-panel" aria-label="Settings">
      <div className="settings-panel-layout">
        <div className="settings-shell">
          <aside className="settings-nav" aria-label="Settings sections">
            <div className="settings-nav-header">
              <div className="settings-nav-eyebrow">Storywright</div>
              <h1 className="settings-panel-title">Settings</h1>
            </div>
            <nav className="settings-nav-list">
              <button
                type="button"
                className={`settings-nav-item ${activeSection === "environment" ? "settings-nav-item-active" : ""}`}
                aria-current={activeSection === "environment" ? "page" : undefined}
                onClick={() => setActiveSection("environment")}
              >
                <span>Environment Variables</span>
                <span className="settings-nav-count">{configuredValueCount}</span>
              </button>
              <button
                type="button"
                className={`settings-nav-item ${activeSection === "story-data" ? "settings-nav-item-active" : ""}`}
                aria-current={activeSection === "story-data" ? "page" : undefined}
                onClick={() => setActiveSection("story-data")}
              >
                <span>Story Data</span>
              </button>
            </nav>
          </aside>

          <div className="settings-content">
            {activeSection === "story-data" ? (
              <>
                <div className="settings-panel-header">
                  <div>
                    <h2 className="settings-section-title">Story Data</h2>
                  </div>
                </div>
                <div className="settings-story-data-section">
                  <p className="settings-section-description">
                    Story データのインポート・エクスポートができます。
                  </p>
                  <div className="settings-story-data-actions">
                    <button className="btn" type="button" onClick={onTriggerImportStories}>
                      Import
                    </button>
                    <button className="btn" type="button" onClick={onTriggerExportStories}>
                      Export All
                    </button>
                  </div>
                </div>
              </>
            ) : (
            <>
            <div className="settings-panel-header">
              <div>
                <h2 className="settings-section-title">Environment Variables</h2>
              </div>
            <div className="settings-panel-actions">
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  if (!activeDomain) return;
                  try {
                    const imported = await onImportEnvironmentFile();
                    if (!imported) return;
                    const mergedValues = Object.fromEntries(
                      [...(activeDomain.values ?? []), ...imported.values].map(({ key, value }) => [key, value]),
                    );
                    const nextRows = toEnvironmentValueRows(
                      Object.entries(mergedValues).map(([key, value]) => ({ key, value })),
                    );
                    setEnvironmentValueRows(nextRows);
                    await updateActiveDomain({ values: mergedValues });
                    setImportError(null);
                  } catch (error) {
                    setImportError(String(error));
                  }
                }}
              >
                Import .env
              </button>
            </div>
          </div>

            <div className="settings-tabbed-panel settings-section-compact">
              <div className="settings-domain-tabs" role="tablist" aria-label="LOCAL_ENV tabs">
                {domains.map((domain) => (
                  <div
                    key={domain.id}
                    role="tab"
                    aria-selected={domain.id === activeDomain?.id}
                    className={`settings-domain-tab ${domain.id === activeDomain?.id ? "settings-domain-tab-active" : ""}`}
                    onClick={() => {
                      setActiveTabId(domain.id);
                    }}
                  >
                    <span
                      className="settings-domain-tab-label"
                      title={domain.name}
                    >
                      {domain.name}
                    </span>
                    {domains.length > 1 && (
                      <button
                        type="button"
                        className="settings-domain-tab-close"
                        aria-label={`Delete LOCAL_ENV ${domain.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const shouldDelete = window.confirm(`Delete LOCAL_ENV "${domain.name}"?`);
                          if (!shouldDelete) return;

                          const nextDomains = domains.filter((candidate) => candidate.id !== domain.id);
                          const nextActiveDomain =
                            domain.id === activeDomain?.id
                              ? (nextDomains[0] ?? null)
                              : (nextDomains.find((candidate) => candidate.id === activeDomain?.id) ?? nextDomains[0] ?? null);

                          void saveDomains(nextDomains, nextActiveDomain?.id);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {canAddEnvironment && (
                  <button
                    type="button"
                    className="settings-domain-tab settings-domain-tab-add"
                    aria-label="Add LOCAL_ENV"
                    title="Add LOCAL_ENV"
                    onClick={() => {
                      const nextId = createNextDomainId(domains);
                      const nextLabel = createNextEnvironmentLabel(domains);
                      void saveDomains(
                        [...domains, { id: nextId, name: nextLabel, matchHost: "", values: [] }],
                        nextId,
                      );
                    }}
                  >
                    +
                  </button>
                )}
              </div>

              <div className="settings-tabbed-body">
                <div className="settings-section-header">
                <div className="settings-domain-header-row">
                  <div />
                </div>
                <div className="settings-domain-manage-row">
                  <label className="panel-field-label" htmlFor="local-env-name-input">
                    Name
                  </label>
                  <input
                    id="local-env-name-input"
                    className="settings-domain-name-input"
                    value={domainNameDraft}
                    onChange={(event) => setDomainNameDraft(event.target.value)}
                    onBlur={() => {
                      if (!activeDomain) return;
                      if (domainNameDraft.trim().length === 0) {
                        setDomainNameDraft(activeDomain.name);
                      }
                    }}
                    placeholder="LOCAL_ENV"
                  />
                </div>
                <div className="settings-domain-manage-row">
                  <label className="panel-field-label" htmlFor="local-env-host-input">
                    Hostname
                  </label>
                  <input
                    id="local-env-host-input"
                    className="settings-domain-name-input"
                    value={matchHostDraft}
                    onChange={(event) => setMatchHostDraft(event.target.value)}
                    placeholder="example.com"
                    aria-label="Environment match host"
                  />
                  <p className="settings-section-description">
                    Hostname に一致するページのみ <code>{"{{LOCAL_ENV.API_KEY}}"}</code> のように参照できます。
                  </p>
                </div>
              </div>
              <div className="settings-value-label-row" aria-hidden="true">
                <span className="panel-field-label">Key</span>
                <span className="panel-field-label">Value</span>
                <span />
              </div>
              <div className="settings-value-list" role="list" aria-label="Environment values">
                {environmentValueRows.map((row) => {
                  const index = environmentValueRows.findIndex((candidate) => candidate.id === row.id);

                  return (
                  <div key={row.id} className="settings-value-row" role="listitem">
                    <input
                      className="settings-value-key-input"
                      value={row.key}
                      onChange={(event) => updateEnvironmentValueRow(row.id, "key", event.target.value)}
                      placeholder="API_KEY"
                      aria-label={`Environment key ${index + 1}`}
                    />
                    <input
                      className="settings-value-input"
                      value={row.value}
                      onChange={(event) => updateEnvironmentValueRow(row.id, "value", event.target.value)}
                      placeholder="secret"
                      aria-label={`Environment value ${index + 1}`}
                    />
                    <button
                      className="settings-icon-button"
                      type="button"
                      aria-label={`Remove environment value ${index + 1}`}
                      onClick={() => removeEnvironmentValueRow(row.id)}
                    >
                      ×
                    </button>
                  </div>
                  );
                })}
              </div>
              <div className="settings-value-actions">
                <button className="settings-icon-button settings-icon-button-add" type="button" aria-label="Add environment value" onClick={addEnvironmentValueRow}>
                  +
                </button>
              </div>
              {duplicateKeys.length > 0 && (
                <div className="settings-inline-error" role="alert">
                  Duplicate keys: {duplicateKeys.join(", ")}
                </div>
              )}
              {(importError ?? environmentSettingsError) && (
                <div className="settings-inline-error" role="alert">
                  {importError ?? environmentSettingsError}
                </div>
              )}
              </div>
            </div>
            </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}