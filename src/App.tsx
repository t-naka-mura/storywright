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
import type { Story, StoryResult, RecordedStep } from "./types";
import "./App.css";

type MainView = "canvas" | "preview";

const initialNodes: Node[] = [
  {
    id: "login",
    type: "screen",
    position: { x: 80, y: 80 },
    data: { label: "ログイン画面", url: "/login" },
  },
  {
    id: "dashboard",
    type: "screen",
    position: { x: 400, y: 40 },
    data: { label: "ダッシュボード", url: "/dashboard" },
  },
  {
    id: "signup",
    type: "screen",
    position: { x: 400, y: 200 },
    data: { label: "新規登録画面", url: "/signup" },
  },
];

const initialEdges: Edge[] = [
  { id: "login-flow", source: "login", target: "dashboard", label: "ログイン" },
  { id: "signup-flow", source: "login", target: "signup", label: "新規登録" },
];

const initialStories: Record<string, Story> = {
  "login-flow": {
    id: "login-flow",
    title: "ログイン",
    steps: [
      { order: 1, action: "navigate", target: "/login", value: "", description: "" },
      { order: 2, action: "type", target: "#email", value: "test@example.com", description: "" },
      { order: 3, action: "type", target: "#password", value: "password", description: "" },
      { order: 4, action: "click", target: "button[type=submit]", value: "", description: "" },
      { order: 5, action: "assert", target: "h1", value: "Dashboard", description: "" },
    ],
  },
  "signup-flow": {
    id: "signup-flow",
    title: "新規登録",
    steps: [],
  },
};

let nodeIdCounter = 0;
let edgeIdCounter = 0;

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [stories, setStories] = useState<Record<string, Story>>(initialStories);
  const [results, setResults] = useState<Record<string, StoryResult>>({});
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [baseUrl, setBaseUrl] = useState("https://example.com");
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [mainView, setMainView] = useState<MainView>("canvas");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedStepCount, setRecordedStepCount] = useState(0);
  const unsubRecorderRef = useRef<(() => void) | null>(null);

  const selectedStory = selectedEdgeId ? stories[selectedEdgeId] ?? null : null;
  const selectedResult = selectedEdgeId ? results[selectedEdgeId] ?? null : null;

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
      if (!isPanelOpen) setIsPanelOpen(true);
    },
    [isPanelOpen],
  );

  const handleUpdateStory = useCallback((story: Story) => {
    setStories((prev) => ({ ...prev, [story.id]: story }));
  }, []);

  const handleRunStory = useCallback(async (story: Story) => {
    setIsRunning(true);
    setResults((prev) => {
      const next = { ...prev };
      delete next[story.id];
      return next;
    });
    try {
      const effectiveBaseUrl = story.baseUrl || baseUrl;
      const result = await window.storywright.runStory(
        JSON.stringify({ ...story, baseUrl: effectiveBaseUrl }),
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
    }
  }, [baseUrl]);

  const handleStartRecording = useCallback(async () => {
    if (!selectedStory) return;
    const url = selectedStory.baseUrl || baseUrl;
    setRecordedStepCount(0);
    setIsRecording(true);

    // ステップ受信リスナーを登録
    const unsub = window.storywright.onRecorderStep((step: RecordedStep) => {
      if (!selectedEdgeId) return;
      setStories((prev) => {
        const story = prev[selectedEdgeId];
        if (!story) return prev;
        const newStep = {
          order: story.steps.length + 1,
          action: step.action as Story["steps"][number]["action"],
          target: step.target,
          value: step.value,
          description: "",
        };
        return { ...prev, [selectedEdgeId]: { ...story, steps: [...story.steps, newStep] } };
      });
      setRecordedStepCount((c) => c + 1);
    });
    unsubRecorderRef.current = unsub;

    try {
      await window.storywright.startRecording(url);
    } catch (err) {
      setIsRecording(false);
      setError({ title: "録画開始エラー", message: String(err) });
    }
  }, [selectedStory, selectedEdgeId, baseUrl]);

  const handleStopRecording = useCallback(async () => {
    setIsRecording(false);
    unsubRecorderRef.current?.();
    unsubRecorderRef.current = null;
    try {
      await window.storywright.stopRecording();
    } catch {
      // 停止エラーは無視
    }
  }, []);

  // 録画中にコンポーネントがアンマウントされた場合のクリーンアップ
  useEffect(() => {
    return () => {
      if (unsubRecorderRef.current) {
        unsubRecorderRef.current();
        window.storywright.stopRecording().catch(() => {});
      }
    };
  }, []);

  const handleTogglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const previewUrl = selectedStory?.baseUrl || baseUrl;

  return (
    <div className="app-layout">
      <Toolbar
        onTogglePanel={handleTogglePanel}
        isPanelOpen={isPanelOpen}
        onAddNode={handleAddNode}
        baseUrl={baseUrl}
        onBaseUrlChange={setBaseUrl}
        mainView={mainView}
        onMainViewChange={setMainView}
        isRecording={isRecording}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        canRecord={selectedStory !== null}
      />
      <div className="main-area">
        {mainView === "canvas" ? (
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
        ) : (
          <PreviewPanel url={previewUrl} isRecording={isRecording} recordedStepCount={recordedStepCount} />
        )}
        <DetailPanel
          isOpen={isPanelOpen}
          onClose={handleClosePanel}
          story={selectedStory}
          storyResult={selectedResult}
          onUpdateStory={handleUpdateStory}
          onRunStory={handleRunStory}
          isRunning={isRunning}
        />
      </div>
      <StatusBar nodeCount={nodes.length} edgeCount={edges.length} isRecording={isRecording} />
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
