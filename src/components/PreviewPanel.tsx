import { useEffect, useRef } from "react";

interface PreviewPanelProps {
  url: string;
}

export function PreviewPanel({ url }: PreviewPanelProps) {
  const currentUrlRef = useRef<string>("");

  useEffect(() => {
    window.storywright.openPreview(url).catch((err) => {
      console.error("Failed to open preview:", err);
    });
    currentUrlRef.current = url;

    return () => {
      window.storywright.closePreview().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (url !== currentUrlRef.current) {
      window.storywright.openPreview(url).catch((err) => {
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
