import { useState, useCallback, useEffect, useRef } from "react";
import { Toolbar } from "./components/Toolbar";
import { PreviewPanel } from "./components/PreviewPanel";
import { DetailPanel } from "./components/DetailPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { HelpPanel } from "./components/HelpPanel";
import { StatusBar } from "./components/StatusBar";
import { ErrorDialog } from "./components/ErrorDialog";
import type { EnvironmentSettings, Story, StoryResult, RepeatResult, RepeatProgress, RecordedStep } from "./types";
import {
  collectEnvironmentRequirements,
  createEnvironmentSetupGuide,
  type EnvironmentSetupGuide,
  getMissingEnvironmentRequirementsForStory,
  type EnvironmentRequirement,
} from "./lib/environmentRequirements";
import { useUrlHistory } from "./hooks/useUrlHistory";
import {
  createExportStoryDocument,
  createStep,
  createStoryMetadata,
  mergeImportedStories,
  normalizeStoriesData,
  normalizeStory,
  serializeStories,
} from "./lib/storyDocument";
import "./App.css";

const defaultStories: Record<string, Story> = {};
const isSettingsWindow = window.location.hash === "#/settings";
const isHelpWindow = window.location.hash === "#/help";

type AppErrorState = {
  title: string;
  message: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  setupGuide?: EnvironmentSetupGuide;
};

let storyIdCounter = 0;

function toPortableFilename(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "story"}.storywright.json`;
}

function getActiveEnvironmentDomain(settings: EnvironmentSettings) {
  if (settings.domains && settings.domains.length > 0) {
    return settings.domains.find((domain) => domain.id === settings.activeDomainId) ?? settings.domains[0];
  }
  return null;
}

function getEnvironmentValuesKey(settings: EnvironmentSettings): string {
  return (getActiveEnvironmentDomain(settings)?.values ?? [])
    .map(({ key, value }) => `${key}=${value}`)
    .join("\n");
}

function App() {
  const [stories, setStories] = useState<Record<string, Story>>(defaultStories);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [results, setResults] = useState<Record<string, StoryResult>>({});
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const { baseUrl, setBaseUrl, urlHistory, addUrlToHistory, deleteUrlFromHistory, loaded: urlHistoryLoaded } = useUrlHistory();
  const [error, setError] = useState<AppErrorState | null>(null);
  const [environmentSettings, setEnvironmentSettings] = useState<EnvironmentSettings>({});
  const [environmentSettingsError, setEnvironmentSettingsError] = useState<string | null>(null);
  const [repeatProgress, setRepeatProgress] = useState<{ current: number; total: number } | null>(null);
  const [repeatResult, setRepeatResult] = useState<RepeatResult | null>(null);
  const unsubRepeatRef = useRef<(() => void) | null>(null);
  const runCancelledRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAssertMode, setIsAssertMode] = useState(false);
  const [recordedStepCount, setRecordedStepCount] = useState(0);
  const [environmentRequirements, setEnvironmentRequirements] = useState<EnvironmentRequirement[]>([]);
  const unsubRecorderRef = useRef<(() => void) | null>(null);
  const unsubAssertDoneRef = useRef<(() => void) | null>(null);

  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const environmentValuesKey = getEnvironmentValuesKey(environmentSettings);

  // 起動時にファイルからデータを読み込み
  useEffect(() => {
    async function load() {
      const savedStories = await window.storywright.loadStories();
      setStories(normalizeStoriesData(savedStories));
      const savedEnvironmentSettings = await window.storywright.loadLocalState("environment") as EnvironmentSettings | null;
      setEnvironmentSettings(savedEnvironmentSettings ?? {});
      setDataLoaded(true);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ファイルへの永続化（データ読み込み完了後のみ）
  useEffect(() => {
    if (!dataLoaded) return;
    window.storywright.saveStories(serializeStories(stories));
  }, [stories, dataLoaded]);

  useEffect(() => {
    let cancelled = false;

    async function loadEnvironmentSourceStatus() {
      try {
        const status = await window.storywright.getEnvironmentSourceStatus();
        if (cancelled) return;
        setEnvironmentSettingsError(status.error ?? null);
      } catch (err) {
        if (cancelled) return;
        setEnvironmentSettingsError(String(err));
      }
    }

    loadEnvironmentSourceStatus();

    return () => {
      cancelled = true;
    };
  }, [environmentValuesKey]);

  useEffect(() => {
    const draftRequirements = collectEnvironmentRequirements(stories, {});
    if (draftRequirements.length === 0) {
      setEnvironmentRequirements([]);
      return;
    }

    let cancelled = false;

    async function loadEnvironmentPresence() {
      const presence = await window.storywright.getEnvironmentVariablePresence(
        draftRequirements.map((requirement) => requirement.name),
      );

      if (cancelled) return;

      const envMap = Object.fromEntries(
        Object.entries(presence).map(([name, isAvailable]) => [name, isAvailable ? "present" : undefined]),
      ) as Record<string, string | undefined>;

      setEnvironmentRequirements(collectEnvironmentRequirements(stories, envMap));
    }

    loadEnvironmentPresence().catch(() => {
      if (!cancelled) {
        setEnvironmentRequirements(draftRequirements);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [stories, environmentValuesKey]);

  const selectedStory = selectedStoryId ? stories[selectedStoryId] ?? null : null;
  const selectedResult = selectedStoryId ? results[selectedStoryId] ?? null : null;

  const handleUpdateStory = useCallback((story: Story) => {
    setStories((prev) => ({ ...prev, [story.id]: normalizeStory(story) }));
  }, []);

  const handleOpenSettingsWindow = useCallback(() => {
    window.storywright.openSettingsWindow().catch(() => {});
  }, []);

  const handleOpenHelpWindow = useCallback(() => {
    window.storywright.openHelpWindow().catch(() => {});
  }, []);

  const handleCloseCurrentWindow = useCallback(() => {
    window.storywright.closeCurrentWindow().catch(() => {});
  }, []);

  const handleToggleCurrentWindowZoom = useCallback(() => {
    window.storywright.toggleCurrentWindowZoom().catch(() => {});
  }, []);

  const handleExportAllStories = useCallback(async () => {
    const storyCount = Object.keys(stories).length;
    if (storyCount === 0) {
      return;
    }

    try {
      const setupGuide = createEnvironmentSetupGuide(stories);
      const filePath = await window.storywright.exportStoriesToFile(
        createExportStoryDocument(stories),
        "storywright-stories.storywright.json",
      );
      if (!filePath) {
        return;
      }
      setError({
        title: "Export 完了",
        message: `${storyCount} stories を export しました。\n\n${filePath}`,
        ...(setupGuide ? { setupGuide } : {}),
      });
    } catch (err) {
      setError({
        title: "Export エラー",
        message: String(err),
      });
    }
  }, [stories]);

  const handleExportStory = useCallback(async (story: Story) => {
    try {
      const setupGuide = createEnvironmentSetupGuide({ [story.id]: story });
      const filePath = await window.storywright.exportStoriesToFile(
        createExportStoryDocument({ [story.id]: story }),
        toPortableFilename(story.title),
      );
      if (!filePath) {
        return;
      }
      setError({
        title: "Export 完了",
        message: `${story.title} を export しました。\n\n${filePath}`,
        ...(setupGuide ? { setupGuide } : {}),
      });
    } catch (err) {
      setError({
        title: "Export エラー",
        message: String(err),
      });
    }
  }, []);

  const handleImportStories = useCallback(async () => {
    try {
      const importedData = await window.storywright.importStoriesFromFile();
      if (!importedData) {
        return;
      }

      const importedStories = normalizeStoriesData(importedData);
      const result = mergeImportedStories(stories, importedStories);
      if (result.importedCount === 0) {
        setError({
          title: "Import エラー",
          message: "Story が含まれていないため import できませんでした。",
        });
        return;
      }

      setStories(result.stories);
      if (result.firstImportedStoryId) {
        setSelectedStoryId(result.firstImportedStoryId);
      }

      const setupGuide = createEnvironmentSetupGuide(importedStories);
      setError({
        title: "Import 完了",
        message:
          `${result.importedCount} stories を取り込みました。` +
          (result.duplicatedCount > 0 ? `\n${result.duplicatedCount} stories は imported copy として追加しました。` : ""),
        ...(setupGuide ? { setupGuide } : {}),
      });
    } catch (err) {
      setError({
        title: "Import エラー",
        message: String(err),
      });
    }
  }, [stories]);

  const handleSaveEnvironmentSettings = useCallback(async (nextSettings: EnvironmentSettings) => {
    setEnvironmentSettings(nextSettings);
    await window.storywright.saveLocalState("environment", nextSettings);
  }, []);

  const handleImportEnvironmentFile = useCallback(async () => {
    return window.storywright.importEnvironmentFile();
  }, []);

  const ensureEnvironmentRequirementsAvailable = useCallback(async (story: Story, url: string) => {
    const storyRequirements = collectEnvironmentRequirements({ [story.id]: story }, {});

    if (storyRequirements.length === 0) {
      return true;
    }

    let envMap: Record<string, string | undefined>;
    try {
      const presence = await window.storywright.getEnvironmentVariablePresence(
        storyRequirements.map((requirement) => requirement.name),
        url,
      );
      envMap = Object.fromEntries(
        Object.entries(presence).map(([name, isAvailable]) => [name, isAvailable ? "present" : undefined]),
      ) as Record<string, string | undefined>;
    } catch (err) {
      const message = String(err);
      setError({
        title: message.includes("match hostname") ? "一致する環境設定がありません" : "環境設定を読み込めませんでした",
        message,
        primaryActionLabel: "Settings を開く",
        onPrimaryAction: handleOpenSettingsWindow,
      });
      return false;
    }

    const missingRequirements = getMissingEnvironmentRequirementsForStory(story, envMap);

    if (missingRequirements.length === 0) {
      return true;
    }

    const missingNames = missingRequirements.map((requirement) => requirement.displayName).join("\n");
    setError({
      title: "環境変数が不足しています",
      message: `この Story の実行に必要な環境変数が不足しています。\n\n${missingNames}\n\nSettings... を開いて不足項目を確認してください。`,
      primaryActionLabel: "Settings を開く",
      onPrimaryAction: handleOpenSettingsWindow,
    });
    return false;
  }, [handleOpenSettingsWindow]);

  const handleRunStory = useCallback(async (story: Story, keepSession: boolean) => {
    const effectiveBaseUrl = story.baseUrl || baseUrl;
    if (!(await ensureEnvironmentRequirementsAvailable(story, effectiveBaseUrl))) {
      return;
    }

    runCancelledRef.current = false;
    setIsRunning(true);
    addUrlToHistory(effectiveBaseUrl);
    setResults((prev) => {
      const next = { ...prev };
      delete next[story.id];
      return next;
    });

    // ステップ進捗リスナー
    const unsubStep = window.storywright.onStepProgress((progress) => {
      setResults((prev) => {
        const existing = prev[progress.storyId];
        const stepResult = {
          order: progress.order,
          status: progress.status === "running" ? ("passed" as const) : progress.status,
          durationMs: progress.durationMs,
          error: progress.error,
        };
        if (!existing) {
          return { ...prev, [progress.storyId]: { storyId: progress.storyId, status: "passed", stepResults: [stepResult] } };
        }
        const stepResults = existing.stepResults.filter((r) => r.order !== progress.order);
        if (progress.status !== "running") {
          stepResults.push(stepResult);
        }
        return { ...prev, [progress.storyId]: { ...existing, stepResults } };
      });
    });

    try {
      const result = await window.storywright.runStory(
        JSON.stringify({ ...story, baseUrl: effectiveBaseUrl }),
        keepSession,
      );
      setResults((prev) => ({ ...prev, [story.id]: result }));
    } catch (err) {
      const errorMsg = String(err);
      setError({
        title: "テスト実行エラー",
        message: errorMsg,
      });
    } finally {
      // キャンセル後に新しい実行が始まっている場合は isRunning を触らない
      if (!runCancelledRef.current) {
        setIsRunning(false);
      }
      unsubStep();
    }
  }, [baseUrl, addUrlToHistory, ensureEnvironmentRequirementsAvailable]);

  const handleRunStoryRepeat = useCallback(async (story: Story, repeatCount: number, keepSession: boolean) => {
    const effectiveBaseUrl = story.baseUrl || baseUrl;
    if (!(await ensureEnvironmentRequirementsAvailable(story, effectiveBaseUrl))) {
      return;
    }

    setIsRunning(true);
    addUrlToHistory(effectiveBaseUrl);
    setRepeatProgress({ current: 0, total: repeatCount });
    setRepeatResult(null);
    setResults((prev) => {
      const next = { ...prev };
      delete next[story.id];
      return next;
    });

    // 進捗リスナー
    const unsub = window.storywright.onRepeatProgress((progress: RepeatProgress) => {
      setRepeatProgress({ current: progress.current, total: progress.total });
    });
    unsubRepeatRef.current = unsub;

    try {
      const result = await window.storywright.runStoryRepeat(
        JSON.stringify({ ...story, baseUrl: effectiveBaseUrl }),
        repeatCount,
        keepSession,
      );
      setRepeatResult(result);
    } catch (err) {
      setError({ title: "繰り返し実行エラー", message: String(err) });
    } finally {
      setIsRunning(false);
      setRepeatProgress(null);
      unsubRepeatRef.current?.();
      unsubRepeatRef.current = null;
    }
  }, [baseUrl, addUrlToHistory, ensureEnvironmentRequirementsAvailable]);

  const handleCancelRepeat = useCallback(async () => {
    try {
      await window.storywright.cancelRepeat();
    } catch {
      // キャンセルエラーは無視
    }
  }, []);

  const handleCancelRun = useCallback(async () => {
    runCancelledRef.current = true;
    setIsRunning(false);
    try {
      await window.storywright.cancelRun();
    } catch {
      // キャンセルエラーは無視
    }
  }, []);

  const handleStartRecording = useCallback(async () => {
    // Story が未選択ならスタンドアロン Story を自動生成
    let targetStoryId = selectedStoryId;
    if (!targetStoryId) {
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const id = `story-${++storyIdCounter}`;
      const newStory: Story = { id, title: `記録 ${timestamp}`, steps: [], metadata: createStoryMetadata(Date.now()) };
      setStories((prev) => ({ ...prev, [id]: newStory }));
      setSelectedStoryId(id);
      targetStoryId = id;
    }

    const recordingStoryId = targetStoryId;
    setRecordedStepCount(0);
    if (!isPanelOpen) setIsPanelOpen(true);
    setIsRecording(true);

    // ステップ受信リスナーを登録
    const unsub = window.storywright.onRecorderStep((step: RecordedStep) => {
      setStories((prev) => {
        const story = prev[recordingStoryId];
        if (!story) return prev;
        const newStep = createStep({
          order: story.steps.length + 1,
          action: step.action as Story["steps"][number]["action"],
          target: step.target,
          value: step.value,
          description: "",
          ...(step.sensitive ? { sensitive: true } : {}),
        });
        return { ...prev, [recordingStoryId]: { ...story, steps: [...story.steps, newStep] } };
      });
      setRecordedStepCount((c) => c + 1);
    });
    unsubRecorderRef.current = unsub;

    // アサート完了リスナー
    const unsubAssert = window.storywright.onAssertDone(() => {
      setIsAssertMode(false);
    });
    unsubAssertDoneRef.current = unsubAssert;

    try {
      await window.storywright.startRecording();
    } catch (err) {
      setIsRecording(false);
      setError({ title: "記録開始エラー", message: String(err) });
    }
  }, [selectedStoryId, isPanelOpen]);

  const handleStopRecording = useCallback(async () => {
    setIsRecording(false);
    setIsAssertMode(false);
    unsubRecorderRef.current?.();
    unsubRecorderRef.current = null;
    unsubAssertDoneRef.current?.();
    unsubAssertDoneRef.current = null;
    try {
      await window.storywright.stopRecording();
    } catch {
      // 停止エラーは無視
    }
  }, []);

  const handleToggleAssertMode = useCallback(async () => {
    const next = !isAssertMode;
    setIsAssertMode(next);
    try {
      await window.storywright.toggleAssertMode(next);
    } catch {
      // エラーは無視
    }
  }, [isAssertMode]);

  // 記録中にコンポーネントがアンマウントされた場合のクリーンアップ
  useEffect(() => {
    return () => {
      unsubRecorderRef.current?.();
      unsubAssertDoneRef.current?.();
      window.storywright.stopRecording().catch(() => {});
    };
  }, []);

  const standaloneStories = Object.values(stories).filter(
    (s) => s.steps.length > 0,
  );

  const handleTogglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev);
  }, []);

  // Story 選択時に baseUrl がある場合はアクティブタブに明示的にロード（ADR-019）
  const handleSelectStory = useCallback((storyId: string) => {
    setSelectedStoryId(storyId);
    if (isRecording) return;
    const story = stories[storyId];
    const storyUrl = story?.baseUrl;
    if (storyUrl && /^https?:\/\//.test(storyUrl)) {
      window.storywright.loadPreviewUrl(storyUrl).catch(() => {});
    }
  }, [stories, isRecording]);

  const handleDeselectStory = useCallback(() => {
    setSelectedStoryId(null);
  }, []);

  const handleDeleteStory = useCallback((storyId: string) => {
    setStories((prev) => {
      const next = { ...prev };
      delete next[storyId];
      return next;
    });
    if (selectedStoryId === storyId) {
      setSelectedStoryId(null);
    }
  }, [selectedStoryId]);

  // URL 履歴ロード完了まで空にして、デフォルト値での初回タブ作成を防ぐ（ADR-019）
  // 記録中は webview の URL を変えない（Story 切替で巻き戻らないように）
  const previewUrl = !urlHistoryLoaded ? "" : isRecording ? baseUrl : (selectedStory?.baseUrl || baseUrl);

  useEffect(() => {
    document.title = isSettingsWindow ? "Settings" : isHelpWindow ? "Help" : "Storywright";
  }, []);

  if (isHelpWindow) {
    return (
      <div className="settings-window-layout">
        <div className="settings-window-titlebar">
          <div className="settings-window-title">Help</div>
          <div className="settings-window-titlebar-actions">
            <button
              type="button"
              className="settings-window-chrome-button"
              aria-label="Expand help window"
              title="Expand help window"
              onClick={handleToggleCurrentWindowZoom}
            >
              <span className="settings-window-chrome-icon settings-window-chrome-icon-expand" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="settings-window-chrome-button settings-window-chrome-button-close"
              aria-label="Close help window"
              title="Close help window"
              onClick={handleCloseCurrentWindow}
            >
              <span className="settings-window-chrome-icon settings-window-chrome-icon-close" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="settings-window-body">
          <HelpPanel />
        </div>
      </div>
    );
  }

  if (isSettingsWindow) {
    return (
      <div className="settings-window-layout">
        <div className="settings-window-titlebar">
          <div className="settings-window-title">Settings</div>
          <div className="settings-window-titlebar-actions">
            <button
              type="button"
              className="settings-window-chrome-button"
              aria-label="Expand settings window"
              title="Expand settings window"
              onClick={handleToggleCurrentWindowZoom}
            >
              <span className="settings-window-chrome-icon settings-window-chrome-icon-expand" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="settings-window-chrome-button settings-window-chrome-button-close"
              aria-label="Close settings window"
              title="Close settings window"
              onClick={handleCloseCurrentWindow}
            >
              <span className="settings-window-chrome-icon settings-window-chrome-icon-close" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="settings-window-body">
          <SettingsPanel
            requirements={environmentRequirements}
            environmentSettings={environmentSettings}
            environmentSettingsError={environmentSettingsError}
            onSaveEnvironmentSettings={handleSaveEnvironmentSettings}
            onImportEnvironmentFile={handleImportEnvironmentFile}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Toolbar
        onTogglePanel={handleTogglePanel}
        isPanelOpen={isPanelOpen}
        isRecording={isRecording}
        isAssertMode={isAssertMode}
        onImportStories={handleImportStories}
        onExportAllStories={handleExportAllStories}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onToggleAssertMode={handleToggleAssertMode}
        canRecord={/^https?:\/\//.test(previewUrl) && !isRunning}
        canExportStories={Object.keys(stories).length > 0}
        onOpenHelp={handleOpenHelpWindow}
      />
      <div className="main-area">
        <>
          <div style={{ display: "flex", flex: 1 }}>
            <PreviewPanel
              url={previewUrl}
              isRecording={isRecording}
              isRunning={isRunning}
              recordedStepCount={recordedStepCount}
              onUrlChange={setBaseUrl}
              urlHistory={urlHistory}
              onDeleteUrlHistory={deleteUrlFromHistory}
              onUrlLoaded={addUrlToHistory}
            />
          </div>
          <DetailPanel
            isOpen={isPanelOpen}
            story={selectedStory}
            storyResult={selectedResult}
            onUpdateStory={handleUpdateStory}
            onRunStory={handleRunStory}
            onRunStoryRepeat={handleRunStoryRepeat}
            onCancelRun={handleCancelRun}
            onCancelRepeat={handleCancelRepeat}
            isRunning={isRunning}
            repeatProgress={repeatProgress}
            repeatResult={repeatResult}
            standaloneStories={standaloneStories}
            storyResults={results}
            onSelectStory={handleSelectStory}
            onDeselectStory={handleDeselectStory}
            onDeleteStory={handleDeleteStory}
            onOpenSettings={handleOpenSettingsWindow}
            onExportStory={handleExportStory}
          />
        </>
      </div>
      <StatusBar isRecording={isRecording} isAssertMode={isAssertMode} />
      {error && (
        <ErrorDialog
          title={error.title}
          message={error.message}
          primaryActionLabel={error.primaryActionLabel}
          onPrimaryAction={error.onPrimaryAction}
          setupGuide={error.setupGuide}
          onClose={() => setError(null)}
        />
      )}
    </div>
  );
}

export default App;
