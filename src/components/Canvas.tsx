import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ScreenNode } from "./ScreenNode";

const nodeTypes = { screen: ScreenNode };

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

let edgeIdCounter = 0;

interface CanvasProps {
  onEdgeClick: (edge: Edge) => void;
}

export function Canvas({ onEdgeClick }: CanvasProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const id = `edge-${++edgeIdCounter}`;
      setEdges((eds) => addEdge({ ...connection, id, label: "新しいストーリー" }, eds));
    },
    [setEdges],
  );

  return (
    <div className="canvas-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={(_event, edge) => onEdgeClick(edge)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
