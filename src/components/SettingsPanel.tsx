import { useEffect, useState } from "react";
import type { EnvironmentSettings, EnvironmentSourceStatus, ImportedEnvironmentValues } from "../types";
import type { EnvironmentRequirement } from "../lib/environmentRequirements";

function getEnvironmentDomains(settings: EnvironmentSettings) {
  return settings.domains ?? [];
}

function toEnvironmentValuesDraft(values: Array<{ key: string; value: string }> | undefined): string {
  return (values ?? [])
    .slice()
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(({ key, value }) => `${key}=${value}`)
    .join("\n");
}

function parseEnvironmentValuesDraft(draft: string): Record<string, string> {
  return Object.fromEntries(
    draft
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) {
          return [line, ""];
        }
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1);
        return [key, value];
      })
      .filter(([key]) => key.length > 0),
  );
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
  const envValuesKey = toEnvironmentValuesDraft(activeDomain?.values);
  const [domainNameDraft, setDomainNameDraft] = useState(activeDomain?.name ?? "");
  const [envValuesDraft, setEnvValuesDraft] = useState(toEnvironmentValuesDraft(activeDomain?.values));
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function saveDomains(nextDomains: typeof domains, activeDomainId = activeDomain?.id ?? nextDomains[0]?.id) {
    return onSaveEnvironmentSettings({
      domains: nextDomains,
      activeDomainId,
    });
  }

  function updateActiveDomain(next: { name?: string; values?: Record<string, string> }) {
    if (!activeDomain) return Promise.resolve();
    const nextDomains = domains.map((domain) => {
      if (domain.id !== activeDomain.id) return domain;
      return {
        ...domain,
        ...(typeof next.name === "string" ? { name: next.name } : {}),
        ...(next.values ? { values: Object.entries(next.values).map(([key, value]) => ({ key, value })) } : {}),
      };
    });
    return saveDomains(nextDomains, activeDomain.id);
  }

  useEffect(() => {
    setDomainNameDraft(activeDomain?.name ?? "");
    setImportSummary(null);
    setImportError(null);
  }, [activeDomain?.id, activeDomain?.name]);

  useEffect(() => {
    setEnvValuesDraft(toEnvironmentValuesDraft(activeDomain?.values));
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
            <div className="settings-domain-list">
              {domains.map((domain) => (
                <button
                  key={domain.id}
                  type="button"
                  className={`settings-domain-item ${domain.id === activeDomain?.id ? "settings-domain-item-active" : ""}`}
                  onClick={() => {
                    void saveDomains(domains, domain.id);
                  }}
                >
                  {domain.name}
                </button>
              ))}
              <button
                type="button"
                className="settings-text-button"
                onClick={() => {
                  const nextId = `domain-${domains.length + 1}`;
                  void saveDomains(
                    [...domains, { id: nextId, name: `Domain ${domains.length + 1}`, values: [] }],
                    nextId,
                  );
                }}
              >
                Add domain
              </button>
            </div>
            <p className="settings-nav-note">
              Story と一緒に export されない local configuration を扱います。
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

            <div className="settings-section settings-section-compact">
              <div className="settings-section-header">
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
                <h3 className="settings-subsection-title">Environment Values</h3>
                <p className="settings-section-description">
                  実行で使う key/value を直接入力します。ここに入れた値が最優先で使われます。
                </p>
              </div>
              <div className="settings-source-row">
                <textarea
                  className="settings-source-input"
                  value={envValuesDraft}
                  onChange={(event) => setEnvValuesDraft(event.target.value)}
                  placeholder={`API_KEY=secret\nBASE_URL=https://example.com`}
                  rows={4}
                />
                <button
                  className="btn"
                  type="button"
                  onClick={() => void updateActiveDomain({ values: parseEnvironmentValuesDraft(envValuesDraft) })}
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
                      setEnvValuesDraft("");
                      void updateActiveDomain({ values: {} });
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
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
                      setEnvValuesDraft(toEnvironmentValuesDraft(imported.values));
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
              </div>

              {requirements.length === 0 ? (
                <div className="settings-empty-state">
                  <p className="settings-empty-title">このワークスペースでは ENV 参照を使っていません</p>
                  <p className="settings-empty-description">
                    Story に <code>{"{{ENV.NAME}}"}</code> を含めると、必要な変数がここに表示されます。
                  </p>
                </div>
              ) : (
                <div className="settings-requirements-list" role="list">
                  {requirements.map((requirement) => (
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