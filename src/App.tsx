import { useState, useCallback, useEffect, useRef } from "react";
import {
  addEdge,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  type OnConnect,
} from "@xyflow/react";
import { Toolbar } from "./components/Toolbar";
import { Canvas } from "./components/Canvas";
import { PreviewPanel } from "./components/PreviewPanel";
import { DetailPanel } from "./components/DetailPanel";
import { StatusBar } from "./components/StatusBar";
import { ErrorDialog } from "./components/ErrorDialog";
import type { Story, StoryResult, RepeatResult, RepeatProgress, RecordedStep } from "./types";
import { useUrlHistory } from "./hooks/useUrlHistory";
import "./App.css";

type MainView = "canvas" | "preview";

const defaultNodes: Node[] = [];
const defaultEdges: Edge[] = [];
const defaultStories: Record<string, Story> = {};

let nodeIdCounter = 0;
let edgeIdCounter = 0;
let storyIdCounter = 0;

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [stories, setStories] = useState<Record<string, Story>>(defaultStories);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [results, setResults] = useState<Record<string, StoryResult>>({});
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const { baseUrl, setBaseUrl, urlHistory, addUrlToHistory, deleteUrlFromHistory } = useUrlHistory();
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [mainView, setMainView] = useState<MainView>("preview");
  const [repeatProgress, setRepeatProgress] = useState<{ current: number; total: number } | null>(null);
  const [repeatResult, setRepeatResult] = useState<RepeatResult | null>(null);
  const unsubRepeatRef = useRef<(() => void) | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAssertMode, setIsAssertMode] = useState(false);
  const [recordedStepCount, setRecordedStepCount] = useState(0);
  const unsubRecorderRef = useRef<(() => void) | null>(null);
  const unsubAssertDoneRef = useRef<(() => void) | null>(null);

  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  // 起動時にファイルからデータを読み込み
  useEffect(() => {
    async function load() {
      const [savedNodes, savedEdges, savedStories] = await Promise.all([
        window.storywright.loadData("nodes.json"),
        window.storywright.loadData("edges.json"),
        window.storywright.loadData("stories.json"),
      ]);
      if (savedNodes) setNodes(savedNodes as Node[]);
      if (savedEdges) setEdges(savedEdges as Edge[]);
      if (savedStories) setStories(savedStories as Record<string, Story>);
      setDataLoaded(true);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ファイルへの永続化（データ読み込み完了後のみ）
  useEffect(() => {
    if (!dataLoaded) return;
    window.storywright.saveData("nodes.json", nodes);
  }, [nodes, dataLoaded]);
  useEffect(() => {
    if (!dataLoaded) return;
    window.storywright.saveData("edges.json", edges);
  }, [edges, dataLoaded]);
  useEffect(() => {
    if (!dataLoaded) return;
    window.storywright.saveData("stories.json", stories);
  }, [stories, dataLoaded]);

  // selectedStoryId を優先し、フォールバックで selectedEdgeId を使う
  const activeStoryId = selectedStoryId ?? selectedEdgeId;
  const selectedStory = activeStoryId ? stories[activeStoryId] ?? null : null;
  const selectedResult = activeStoryId ? results[activeStoryId] ?? null : null;

  const handleAddNode = useCallback(() => {
    const id = `screen-${++nodeIdCounter}`;
    const newNode: Node = {
      id,
      type: "screen",
      position: { x: 200 + Math.random() * 100, y: 150 + Math.random() * 100 },
      data: { label: "新しい画面", url: "/new" },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const handleUpdateNode = useCallback(
    (nodeId: string, data: { label: string; url: string }) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)),
      );
    },
    [setNodes],
  );

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      const id = `edge-${++edgeIdCounter}`;
      const title = "新しいストーリー";
      setEdges((eds) => addEdge({ ...connection, id, label: title }, eds));
      setStories((prev) => ({
        ...prev,
        [id]: { id, title, steps: [] },
      }));
    },
    [setEdges],
  );

  const handleUpdateEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, label } : e)));
      setStories((prev) => {
        const story = prev[edgeId];
        if (!story) return prev;
        return { ...prev, [edgeId]: { ...story, title: label } };
      });
    },
    [setEdges],
  );

  const handleEdgeClick = useCallback(
    (_edge: Edge) => {
      setSelectedEdgeId(_edge.id);
      setSelectedStoryId(null);
      if (!isPanelOpen) setIsPanelOpen(true);
    },
    [isPanelOpen],
  );

  const handleUpdateStory = useCallback((story: Story) => {
    setStories((prev) => ({ ...prev, [story.id]: story }));
  }, []);

  const handleRunStory = useCallback(async (story: Story, keepSession: boolean) => {
    setIsRunning(true);
    setMainView("preview");
    const effectiveBaseUrl = story.baseUrl || baseUrl;
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
      setIsRunning(false);
      unsubStep();
    }
  }, [baseUrl, addUrlToHistory]);

  const handleRunStoryRepeat = useCallback(async (story: Story, repeatCount: number, keepSession: boolean) => {
    setIsRunning(true);
    setMainView("preview");
    const effectiveBaseUrl = story.baseUrl || baseUrl;
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
  }, [baseUrl, addUrlToHistory]);

  const handleCancelRepeat = useCallback(async () => {
    try {
      await window.storywright.cancelRepeat();
    } catch {
      // キャンセルエラーは無視
    }
  }, []);

  const handleStartRecording = useCallback(async () => {
    // Story が未選択ならスタンドアロン Story を自動生成
    let targetStoryId = activeStoryId;
    if (!targetStoryId) {
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const id = `story-${++storyIdCounter}`;
      const newStory: Story = { id, title: `録画 ${timestamp}`, steps: [] };
      setStories((prev) => ({ ...prev, [id]: newStory }));
      setSelectedStoryId(id);
      targetStoryId = id;
    }

    const recordingStoryId = targetStoryId;
    setRecordedStepCount(0);
    setIsRecording(true);

    // ステップ受信リスナーを登録
    const unsub = window.storywright.onRecorderStep((step: RecordedStep) => {
      setStories((prev) => {
        const story = prev[recordingStoryId];
        if (!story) return prev;
        const newStep = {
          order: story.steps.length + 1,
          action: step.action as Story["steps"][number]["action"],
          target: step.target,
          value: step.value,
          description: "",
        };
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
      setError({ title: "録画開始エラー", message: String(err) });
    }
  }, [activeStoryId]);

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

  // 録画中にコンポーネントがアンマウントされた場合のクリーンアップ
  useEffect(() => {
    return () => {
      unsubRecorderRef.current?.();
      unsubAssertDoneRef.current?.();
      window.storywright.stopRecording().catch(() => {});
    };
  }, []);

  // スタンドアロン Story（エッジに紐づかない Story）の一覧
  const edgeIds = new Set(edges.map((e) => e.id));
  const standaloneStories = Object.values(stories).filter(
    (s) => !edgeIds.has(s.id) && s.steps.length > 0,
  );

  // スタンドアロン Story のステップをエッジの Story にコピーし、元を削除
  const handleAssignStory = useCallback((standaloneStoryId: string) => {
    if (!activeStoryId) return;
    setStories((prev) => {
      const source = prev[standaloneStoryId];
      const target = prev[activeStoryId];
      if (!source || !target) return prev;
      const next = { ...prev };
      next[activeStoryId] = { ...target, steps: [...source.steps] };
      delete next[standaloneStoryId];
      return next;
    });
  }, [activeStoryId]);

  const handleTogglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  // 録画中は webview の URL を変えない（Story 切替で巻き戻らないように）
  const previewUrl = isRecording ? baseUrl : (selectedStory?.baseUrl || baseUrl);

  return (
    <div className="app-layout">
      <Toolbar
        onTogglePanel={handleTogglePanel}
        isPanelOpen={isPanelOpen}
        onAddNode={handleAddNode}
        mainView={mainView}
        onMainViewChange={setMainView}
        isRecording={isRecording}
        isAssertMode={isAssertMode}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onToggleAssertMode={handleToggleAssertMode}
        canRecord={/^https?:\/\//.test(previewUrl) && !isRunning}
      />
      <div className="main-area">
        <div style={{ display: mainView === "canvas" ? "flex" : "none", flex: 1 }}>
          <Canvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onEdgeClick={handleEdgeClick}
            onUpdateNode={handleUpdateNode}
            onUpdateEdgeLabel={handleUpdateEdgeLabel}
          />
        </div>
        <div style={{ display: mainView === "preview" ? "flex" : "none", flex: 1 }}>
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
          onClose={handleClosePanel}
          story={selectedStory}
          storyResult={selectedResult}
          onUpdateStory={handleUpdateStory}
          onRunStory={handleRunStory}
          onRunStoryRepeat={handleRunStoryRepeat}
          onCancelRepeat={handleCancelRepeat}
          isRunning={isRunning}
          repeatProgress={repeatProgress}
          repeatResult={repeatResult}
          mainView={mainView}
          standaloneStories={standaloneStories}
          onAssignStory={handleAssignStory}
        />
      </div>
      <StatusBar nodeCount={nodes.length} edgeCount={edges.length} isRecording={isRecording} isAssertMode={isAssertMode} />
      {error && (
        <ErrorDialog
          title={error.title}
          message={error.message}
          onClose={() => setError(null)}
        />
      )}
    </div>
  );
}

export default App;
