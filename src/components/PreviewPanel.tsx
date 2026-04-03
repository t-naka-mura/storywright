import { useRef, useEffect, useCallback } from "react";

interface PreviewPanelProps {
  url: string;
  isRecording: boolean;
  recordedStepCount: number;
  onUrlLoaded?: (url: string) => void;
}

export function PreviewPanel({ url, isRecording, recordedStepCount, onUrlLoaded }: PreviewPanelProps) {
  const hasUrl = url && /^https?:\/\//.test(url);
  const webviewRef = useRef<HTMLElement>(null);

  const handleDidFinishLoad = useCallback(() => {
    if (!webviewRef.current || !onUrlLoaded) return;
    const loadedUrl = (webviewRef.current as unknown as { getURL: () => string }).getURL();
    if (loadedUrl && /^https?:\/\//.test(loadedUrl)) {
      // ベース URL 部分（origin）を保存
      try {
        const origin = new URL(loadedUrl).origin;
        onUrlLoaded(origin);
      } catch {
        onUrlLoaded(loadedUrl);
      }
    }
  }, [onUrlLoaded]);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    wv.addEventListener("did-finish-load", handleDidFinishLoad);
    return () => {
      wv.removeEventListener("did-finish-load", handleDidFinishLoad);
    };
  }, [handleDidFinishLoad]);

  return (
    <div className="preview-panel">
      {isRecording && (
        <div className="preview-recording-badge">
          ● 録画中 — {recordedStepCount} ステップ記録済み
        </div>
      )}
      {hasUrl ? (
        <webview
          ref={webviewRef as React.Ref<HTMLElement>}
          src={url}
          style={{ width: "100%", height: "100%" }}
          allowpopups
        />
      ) : (
        <div className="preview-empty">
          <p className="preview-empty-icon">🌐</p>
          <p className="preview-empty-text">
            右上の Base URL にサイトの URL を入力してください
          </p>
          <p className="preview-empty-hint">
            例: https://example.com
          </p>
        </div>
      )}
    </div>
  );
}
