import { useEffect, useState } from "react";
import type { EnvironmentDomain, EnvironmentSettings, EnvironmentSourceStatus, ImportedEnvironmentValues } from "../types";
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

function createNextDomainId(domains: EnvironmentDomain[]) {
  const existingIds = new Set(domains.map((domain) => domain.id));

  do {
    domainIdCounter += 1;
  } while (existingIds.has(`domain-${domainIdCounter}`));

  return `domain-${domainIdCounter}`;
}

interface SettingsPanelProps {
  requirements: EnvironmentRequirement[];
  environmentSettings: EnvironmentSettings;
  environmentSettingsError: string | null;
  environmentSourceStatus: EnvironmentSourceStatus | null;
  onSaveEnvironmentSettings: (settings: EnvironmentSettings) => Promise<void>;
  onImportEnvironmentFile: () => Promise<ImportedEnvironmentValues | null>;
}

export function SettingsPanel({
  requirements,
  environmentSettings,
  environmentSettingsError,
  environmentSourceStatus,
  onSaveEnvironmentSettings,
  onImportEnvironmentFile,
}: SettingsPanelProps) {
  const missingCount = requirements.filter((requirement) => requirement.status === "missing").length;
  const domains = getEnvironmentDomains(environmentSettings);
  const activeDomain = domains.find((domain) => domain.id === environmentSettings.activeDomainId) ?? domains[0] ?? null;
  const envValuesKey = JSON.stringify(activeDomain?.values ?? []);
  const [domainNameDraft, setDomainNameDraft] = useState(activeDomain?.name ?? "");
  const [environmentValueRows, setEnvironmentValueRows] = useState<EnvironmentValueRow[]>(
    toEnvironmentValueRows(activeDomain?.values),
  );
  const [valueSearchQuery, setValueSearchQuery] = useState("");
  const [requirementSearchQuery, setRequirementSearchQuery] = useState("");
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const duplicateKeys = getDuplicateEnvironmentKeys(environmentValueRows);
  const savedValueRows = toEnvironmentValueRows(activeDomain?.values);
  const hasUnsavedValueChanges =
    JSON.stringify(toEnvironmentDomainValues(environmentValueRows)) !== JSON.stringify(toEnvironmentDomainValues(savedValueRows));
  const normalizedValueSearchQuery = valueSearchQuery.trim().toLowerCase();
  const normalizedRequirementSearchQuery = requirementSearchQuery.trim().toLowerCase();
  const filteredEnvironmentValueRows = environmentValueRows.filter((row) => {
    if (normalizedValueSearchQuery.length === 0) {
      return true;
    }

    return row.key.toLowerCase().includes(normalizedValueSearchQuery) || row.value.toLowerCase().includes(normalizedValueSearchQuery);
  });
  const filteredRequirements = requirements.filter((requirement) => {
    if (normalizedRequirementSearchQuery.length === 0) {
      return true;
    }

    return (
      requirement.displayName.toLowerCase().includes(normalizedRequirementSearchQuery) ||
      requirement.stories.some((story) => story.storyTitle.toLowerCase().includes(normalizedRequirementSearchQuery))
    );
  });

  async function persistEnvironmentValues(rows: EnvironmentValueRow[]) {
    await updateActiveDomain({ values: toEnvironmentDomainValues(rows) });
  }

  function saveDomains(nextDomains: typeof domains, activeDomainId = activeDomain?.id ?? nextDomains[0]?.id) {
    return onSaveEnvironmentSettings({
      domains: nextDomains,
      activeDomainId,
    });
  }

  function updateActiveDomain(next: {
    name?: string;
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
    setValueSearchQuery("");
    setImportSummary(null);
    setImportError(null);
  }, [activeDomain?.id, activeDomain?.name]);

  useEffect(() => {
    setEnvironmentValueRows(toEnvironmentValueRows(activeDomain?.values));
  }, [envValuesKey]);

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
              <button type="button" className="settings-nav-item settings-nav-item-active" aria-current="page">
                <span>Environment Variables</span>
                <span className="settings-nav-count">{requirements.length}</span>
              </button>
            </nav>
            <p className="settings-nav-note">
              Domain は上部タブで切り替えます。Story と一緒に export されない local configuration を扱います。
            </p>
          </aside>

          <div className="settings-content">
            <div className="settings-panel-header">
              <div>
                <h2 className="settings-section-title">Environment Variables</h2>
                <p className="settings-panel-subtitle">
                  Environment Variables の利用状況を確認できます。ここに表示される情報は local-only で、Story の export には含まれません。
                </p>
              </div>
              {requirements.length > 0 && (
                <div className="settings-panel-summary">
                  <span className={`settings-summary-badge ${missingCount > 0 ? "settings-summary-badge-warning" : "settings-summary-badge-ok"}`}>
                    {missingCount > 0 ? `${missingCount} missing` : "All available"}
                  </span>
                </div>
              )}
            </div>

            <div className="settings-domain-tabs" role="tablist" aria-label="Environment domains">
              {domains.map((domain) => (
                <button
                  key={domain.id}
                  type="button"
                  role="tab"
                  aria-selected={domain.id === activeDomain?.id}
                  className={`settings-domain-tab ${domain.id === activeDomain?.id ? "settings-domain-tab-active" : ""}`}
                  onClick={() => {
                    void saveDomains(domains, domain.id);
                  }}
                >
                  {domain.name}
                </button>
              ))}
              <button
                type="button"
                className="settings-domain-tab settings-domain-tab-add"
                onClick={() => {
                  const nextId = createNextDomainId(domains);
                  void saveDomains(
                    [...domains, { id: nextId, name: `Domain ${domains.length + 1}`, values: [] }],
                    nextId,
                  );
                }}
              >
                + Add domain
              </button>
            </div>

            <div className="settings-section settings-section-compact">
              <div className="settings-section-header">
                <div className="settings-domain-header-row">
                  <div>
                    <div className="settings-subsection-title">Environment Values</div>
                    <p className="settings-section-description">
                      選択中の domain の key/value を編集します。ここに入れた値が最優先で使われます。
                    </p>
                  </div>
                  {activeDomain && <div className="settings-domain-active-label">Editing {activeDomain.name}</div>}
                </div>
                <div className="settings-domain-manage-row">
                  <input
                    className="settings-domain-name-input"
                    value={domainNameDraft}
                    onChange={(event) => setDomainNameDraft(event.target.value)}
                    onBlur={() => {
                      if (!activeDomain) return;
                      const nextName = domainNameDraft.trim() || activeDomain.name;
                      if (nextName !== activeDomain.name) {
                        void updateActiveDomain({ name: nextName });
                      }
                    }}
                    placeholder="Domain name"
                  />
                  <button
                    className="settings-text-button"
                    type="button"
                    disabled={!activeDomain || domains.length <= 1}
                    onClick={() => {
                      if (!activeDomain) return;
                      const shouldDelete = window.confirm(`Delete domain \"${activeDomain.name}\"?`);
                      if (!shouldDelete) return;

                      const nextDomains = domains.filter((domain) => domain.id !== activeDomain.id);
                      const nextActiveDomain = nextDomains[0] ?? null;
                      void saveDomains(nextDomains, nextActiveDomain?.id);
                    }}
                  >
                    Delete current domain
                  </button>
                </div>
              </div>
              <div className="settings-search-row">
                <input
                  className="settings-search-input"
                  value={valueSearchQuery}
                  onChange={(event) => setValueSearchQuery(event.target.value)}
                  placeholder="Search values"
                  aria-label="Search environment values"
                />
                {hasUnsavedValueChanges && <span className="settings-dirty-badge">Unsaved changes</span>}
              </div>
              <div className="settings-value-list" role="list" aria-label="Environment values">
                {filteredEnvironmentValueRows.map((row) => {
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
                      className="settings-text-button"
                      type="button"
                      onClick={() => removeEnvironmentValueRow(row.id)}
                    >
                      Remove
                    </button>
                  </div>
                  );
                })}
              </div>
              {filteredEnvironmentValueRows.length === 0 && (
                <div className="settings-empty-inline">No matching values.</div>
              )}
              <div className="settings-value-actions">
                <button className="btn" type="button" onClick={addEnvironmentValueRow}>
                  Add row
                </button>
                <button
                  className="btn"
                  type="button"
                  disabled={!activeDomain || duplicateKeys.length > 0 || !hasUnsavedValueChanges}
                  onClick={() => void persistEnvironmentValues(environmentValueRows)}
                >
                  Save
                </button>
              </div>
              <div className="settings-source-meta-row">
                <span className="settings-source-meta">
                  {(activeDomain?.values.length ?? 0) > 0
                    ? `${activeDomain?.values.length ?? 0} values saved`
                    : "No inline values yet"}
                </span>
                {(activeDomain?.values.length ?? 0) > 0 && (
                  <button
                    className="settings-text-button"
                    type="button"
                    onClick={() => {
                      const nextRows = [createEnvironmentValueRow()];
                      setEnvironmentValueRows(nextRows);
                      void persistEnvironmentValues(nextRows);
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {duplicateKeys.length > 0 && (
                <div className="settings-inline-error" role="alert">
                  Duplicate keys: {duplicateKeys.join(", ")}
                </div>
              )}
            </div>

            <div className="settings-section settings-section-compact">
              <div className="settings-section-header">
                <h3 className="settings-subsection-title">Import .env</h3>
                <p className="settings-section-description">
                  `.env` は active domain の key/value に取り込みます。取り込み後はこの画面でそのまま編集できます。
                </p>
              </div>
              <div className="settings-source-row">
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
                      setImportSummary(`${imported.filePath} から ${imported.values.length} 件取り込みました`);
                      setImportError(null);
                    } catch (error) {
                      setImportSummary(null);
                      setImportError(String(error));
                    }
                  }}
                >
                  Import .env
                </button>
              </div>
              <div className="settings-source-meta-row">
                <span className="settings-source-meta">
                  {activeDomain ? "選択中の domain に値を追加します" : "先に domain を作成してください"}
                </span>
              </div>
              {importSummary && <div className="settings-source-meta">{importSummary}</div>}
              {environmentSourceStatus && (
                <div className="settings-source-status-row">
                  <span className={`settings-source-status-badge ${environmentSourceStatus.error ? "settings-source-status-badge-error" : "settings-source-status-badge-ok"}`}>
                    {environmentSourceStatus.error
                      ? "Load failed"
                      : environmentSourceStatus.mode === "domain-values"
                        ? "Domain values active"
                        : "process.env"}
                  </span>
                  <span className="settings-source-meta">
                    {environmentSourceStatus.error
                      ? "設定を確認してください"
                      : `${environmentSourceStatus.inlineValueCount} domain values, ${environmentSourceStatus.loadedVariableCount} resolved variables`}
                  </span>
                </div>
              )}
              {(importError ?? environmentSettingsError) && (
                <div className="settings-inline-error" role="alert">
                  {importError ?? environmentSettingsError}
                </div>
              )}
            </div>

            <div className="settings-section">
              <div className="settings-section-header">
                <p className="settings-section-description">
                  `baseUrl`, step の `target`, `value` に含まれる `ENV.*` を集約しています。
                </p>
                <div className="settings-search-row settings-search-row-secondary">
                  <input
                    className="settings-search-input"
                    value={requirementSearchQuery}
                    onChange={(event) => setRequirementSearchQuery(event.target.value)}
                    placeholder="Search requirements or stories"
                    aria-label="Search environment requirements"
                  />
                </div>
              </div>

              {requirements.length === 0 ? (
                <div className="settings-empty-state">
                  <p className="settings-empty-title">このワークスペースでは ENV 参照を使っていません</p>
                  <p className="settings-empty-description">
                    Story に <code>{"{{ENV.NAME}}"}</code> を含めると、必要な変数がここに表示されます。
                  </p>
                </div>
              ) : filteredRequirements.length === 0 ? (
                <div className="settings-empty-inline">No matching requirements.</div>
              ) : (
                <div className="settings-requirements-list" role="list">
                  {filteredRequirements.map((requirement) => (
                    <article key={requirement.name} className="settings-requirement-card" role="listitem">
                      <div className="settings-requirement-top">
                        <div>
                          <div className="settings-requirement-name">{requirement.displayName}</div>
                          <div className="settings-requirement-meta">
                            {requirement.occurrenceCount} references in {requirement.stories.length} stories
                          </div>
                        </div>
                        <span
                          className={`settings-requirement-status settings-requirement-status-${requirement.status}`}
                          aria-label={`status ${requirement.status}`}
                        >
                          {requirement.status}
                        </span>
                      </div>
                      <div className="settings-requirement-story-list">
                        {requirement.stories.map((story) => (
                          <span key={story.storyId} className="settings-requirement-story-chip">
                            {story.storyTitle}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}