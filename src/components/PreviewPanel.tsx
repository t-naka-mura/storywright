import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface PreviewPanelProps {
  url: string;
}

export function PreviewPanel({ url }: PreviewPanelProps) {
  const currentUrlRef = useRef<string>("");

  useEffect(() => {
    invoke("open_preview", { url }).catch((err) => {
      console.error("Failed to open preview:", err);
    });
    currentUrlRef.current = url;

    return () => {
      invoke("close_preview").catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (url !== currentUrlRef.current) {
      invoke("open_preview", { url }).catch((err) => {
        console.error("Failed to update preview:", err);
      });
      currentUrlRef.current = url;
    }
  }, [url]);

  return (
    <div className="preview-panel">
      <div className="preview-placeholder">
        <p className="preview-placeholder-text">
          プレビューウィンドウで表示中
        </p>
        <p className="preview-placeholder-url">{url}</p>
      </div>
    </div>
  );
}
