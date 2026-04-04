import { useEffect, useState } from "react";
import type { EnvironmentSettings } from "../types";
import type { EnvironmentRequirement } from "../lib/environmentRequirements";

interface SettingsPanelProps {
  requirements: EnvironmentRequirement[];
  environmentSettings: EnvironmentSettings;
  environmentSettingsError: string | null;
  onSaveEnvironmentSettings: (settings: EnvironmentSettings) => Promise<void>;
  onChooseEnvironmentFile: () => Promise<string | null>;
}

export function SettingsPanel({
  requirements,
  environmentSettings,
  environmentSettingsError,
  onSaveEnvironmentSettings,
  onChooseEnvironmentFile,
}: SettingsPanelProps) {
  const missingCount = requirements.filter((requirement) => requirement.status === "missing").length;
  const [envFilePathDraft, setEnvFilePathDraft] = useState(environmentSettings.envFilePath ?? "");

  useEffect(() => {
    setEnvFilePathDraft(environmentSettings.envFilePath ?? "");
  }, [environmentSettings.envFilePath]);

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
                <h3 className="settings-subsection-title">Environment Source</h3>
                <p className="settings-section-description">
                  `.env` ファイルを指定すると、同名の値は `process.env` より優先して解決されます。
                </p>
              </div>
              <div className="settings-source-row">
                <input
                  className="settings-source-input"
                  value={envFilePathDraft}
                  onChange={(event) => setEnvFilePathDraft(event.target.value)}
                  placeholder="/path/to/.env"
                />
                <button className="btn" type="button" onClick={async () => {
                  const selected = await onChooseEnvironmentFile();
                  if (!selected) return;
                  setEnvFilePathDraft(selected);
                  await onSaveEnvironmentSettings({ envFilePath: selected });
                }}>
                  Browse
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => onSaveEnvironmentSettings({ envFilePath: envFilePathDraft || undefined })}
                >
                  Save
                </button>
              </div>
              <div className="settings-source-meta-row">
                <span className="settings-source-meta">
                  {environmentSettings.envFilePath ? `Using ${environmentSettings.envFilePath}` : "Using process.env only"}
                </span>
                {environmentSettings.envFilePath && (
                  <button
                    className="settings-text-button"
                    type="button"
                    onClick={() => {
                      setEnvFilePathDraft("");
                      void onSaveEnvironmentSettings({});
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {environmentSettingsError && (
                <div className="settings-inline-error" role="alert">
                  {environmentSettingsError}
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