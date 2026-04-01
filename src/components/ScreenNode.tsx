import { useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

type ScreenNodeData = {
  label: string;
  url: string;
  onUpdate?: (nodeId: string, data: { label: string; url: string }) => void;
};

type ScreenNodeType = Node<ScreenNodeData, "screen">;

export function ScreenNode({ id, data }: NodeProps<ScreenNodeType>) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const [url, setUrl] = useState(data.url);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(data.label);
    setUrl(data.url);
  }, [data.label, data.url]);

  useEffect(() => {
    if (editing && labelRef.current) {
      labelRef.current.focus();
      labelRef.current.select();
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    setEditing(false);
    data.onUpdate?.(id, { label, url });
  }, [id, data, label, url]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        setLabel(data.label);
        setUrl(data.url);
        setEditing(false);
      }
      e.stopPropagation();
    },
    [handleSave, data.label, data.url],
  );

  return (
    <div className="screen-node" onDoubleClick={() => setEditing(true)}>
      <Handle type="target" position={Position.Left} />
      {editing ? (
        <div className="screen-node-edit" onClick={(e) => e.stopPropagation()}>
          <input
            ref={labelRef}
            className="screen-node-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="画面名"
          />
          <input
            className="screen-node-input screen-node-input-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="URL"
          />
          <div className="screen-node-edit-actions">
            <button className="btn btn-sm" type="button" onClick={handleSave}>
              Save
            </button>
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => {
                setLabel(data.label);
                setUrl(data.url);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="screen-node-title">{data.label}</div>
          <div className="screen-node-url">{data.url}</div>
        </>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
