import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ScreenNode } from "./ScreenNode";
import { EditableEdgeLabel } from "./EditableEdgeLabel";

const nodeTypes = { screen: ScreenNode };
const edgeTypes = { editableEdge: EditableEdgeLabel };

interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onEdgeClick: (edge: Edge) => void;
  onUpdateNode: (nodeId: string, data: { label: string; url: string }) => void;
  onUpdateEdgeLabel: (edgeId: string, label: string) => void;
}

export function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onEdgeClick,
  onUpdateNode,
  onUpdateEdgeLabel,
}: CanvasProps) {
  const nodesWithCallbacks = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: { ...node.data, onUpdate: onUpdateNode },
      })),
    [nodes, onUpdateNode],
  );

  const edgesWithLabels = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        label: undefined,
        data: { ...edge.data, label: edge.label as string, onUpdateLabel: onUpdateEdgeLabel },
        type: "editableEdge" as const,
      })),
    [edges, onUpdateEdgeLabel],
  );

  return (
    <div className="canvas-container">
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edgesWithLabels}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={(_event, edge) => onEdgeClick(edge)}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
