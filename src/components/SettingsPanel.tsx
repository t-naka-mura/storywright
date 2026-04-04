import { useEffect, useState } from "react";
import type { EnvironmentSettings, EnvironmentSourceStatus } from "../types";
import type { EnvironmentRequirement } from "../lib/environmentRequirements";

function getEnvironmentFilePaths(settings: EnvironmentSettings): string[] {
  if (settings.envFilePaths && settings.envFilePaths.length > 0) {
    return settings.envFilePaths;
  }
  return settings.envFilePath ? [settings.envFilePath] : [];
}

function parseEnvironmentFilePaths(draft: string): string[] {
  return draft
    .split("\n")
    .map((envFilePath) => envFilePath.trim())
    .filter((envFilePath, index, array) => envFilePath.length > 0 && array.indexOf(envFilePath) === index);
}

interface SettingsPanelProps {
  requirements: EnvironmentRequirement[];
  environmentSettings: EnvironmentSettings;
  environmentSettingsError: string | null;
  environmentSourceStatus: EnvironmentSourceStatus | null;
  onSaveEnvironmentSettings: (settings: EnvironmentSettings) => Promise<void>;
  onChooseEnvironmentFile: () => Promise<string | null>;
}

export function SettingsPanel({
  requirements,
  environmentSettings,
  environmentSettingsError,
  environmentSourceStatus,
  onSaveEnvironmentSettings,
  onChooseEnvironmentFile,
}: SettingsPanelProps) {
  const missingCount = requirements.filter((requirement) => requirement.status === "missing").length;
  const [envFilePathsDraft, setEnvFilePathsDraft] = useState(getEnvironmentFilePaths(environmentSettings).join("\n"));
  const activeEnvFilePaths = getEnvironmentFilePaths(environmentSettings);

  useEffect(() => {
    setEnvFilePathsDraft(activeEnvFilePaths.join("\n"));
  }, [activeEnvFilePaths.join("\n")]);

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
                  `.env` ファイルを上から順に読み込みます。後ろの file ほど優先され、すべて `process.env` より優先して解決されます。
                </p>
              </div>
              <div className="settings-source-row">
                <textarea
                  className="settings-source-input"
                  value={envFilePathsDraft}
                  onChange={(event) => setEnvFilePathsDraft(event.target.value)}
                  placeholder={`/path/to/.env\n/path/to/.env.local`}
                  rows={3}
                />
                <button className="btn" type="button" onClick={async () => {
                  const selected = await onChooseEnvironmentFile();
                  if (!selected) return;
                  const nextPaths = [...parseEnvironmentFilePaths(envFilePathsDraft), selected]
                    .filter((envFilePath, index, array) => array.indexOf(envFilePath) === index);
                  setEnvFilePathsDraft(nextPaths.join("\n"));
                  await onSaveEnvironmentSettings(nextPaths.length > 0 ? { envFilePaths: nextPaths } : {});
                }}>
                  Browse
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    const nextPaths = parseEnvironmentFilePaths(envFilePathsDraft);
                    return onSaveEnvironmentSettings(nextPaths.length > 0 ? { envFilePaths: nextPaths } : {});
                  }}
                >
                  Save
                </button>
              </div>
              <div className="settings-source-meta-row">
                <span className="settings-source-meta">
                  {activeEnvFilePaths.length > 0 ? `Using ${activeEnvFilePaths.length} files in order` : "Using process.env only"}
                </span>
                {activeEnvFilePaths.length > 0 && (
                  <button
                    className="settings-text-button"
                    type="button"
                    onClick={() => {
                      setEnvFilePathsDraft("");
                      void onSaveEnvironmentSettings({});
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {activeEnvFilePaths.length > 0 && (
                <div className="settings-source-path-list" role="list" aria-label="Configured environment files">
                  {activeEnvFilePaths.map((envFilePath, index) => (
                    <div key={envFilePath} className="settings-source-path-item" role="listitem">
                      <span className="settings-source-path-index">{index + 1}</span>
                      <span className="settings-source-path-text">{envFilePath}</span>
                    </div>
                  ))}
                </div>
              )}
              {environmentSourceStatus && (
                <div className="settings-source-status-row">
                  <span className={`settings-source-status-badge ${environmentSourceStatus.error ? "settings-source-status-badge-error" : "settings-source-status-badge-ok"}`}>
                    {environmentSourceStatus.error
                      ? "Load failed"
                      : environmentSourceStatus.mode === "env-files"
                        ? `${environmentSourceStatus.loadedFileCount} files active`
                        : "process.env"}
                  </span>
                  <span className="settings-source-meta">
                    {environmentSourceStatus.error
                      ? "設定を確認してください"
                      : environmentSourceStatus.mode === "env-files"
                        ? `${environmentSourceStatus.loadedVariableCount} variables available after ${environmentSourceStatus.loadedFileCount} layers`
                        : `${environmentSourceStatus.loadedVariableCount} variables available`}
                  </span>
                </div>
              )}
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