import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

type ScreenNodeData = {
  label: string;
  url: string;
};

type ScreenNode = Node<ScreenNodeData, "screen">;

export function ScreenNode({ data }: NodeProps<ScreenNode>) {
  return (
    <div className="screen-node">
      <Handle type="target" position={Position.Left} />
      <div className="screen-node-title">{data.label}</div>
      <div className="screen-node-url">{data.url}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
