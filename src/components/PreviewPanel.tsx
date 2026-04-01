import { useEffect, useRef } from "react";

interface PreviewPanelProps {
  url: string;
  isRecording: boolean;
  recordedStepCount: number;
}

export function PreviewPanel({ url, isRecording, recordedStepCount }: PreviewPanelProps) {
  const currentUrlRef = useRef<string>("");

  useEffect(() => {
    if (!isRecording) {
      window.storywright.openPreview(url).catch((err) => {
        console.error("Failed to open preview:", err);
      });
      currentUrlRef.current = url;
    }

    return () => {
      if (!isRecording) {
        window.storywright.closePreview().catch(() => {});
      }
    };
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isRecording && url !== currentUrlRef.current) {
      window.storywright.openPreview(url).catch((err) => {
        console.error("Failed to update preview:", err);
      });
      currentUrlRef.current = url;
    }
  }, [url, isRecording]);

  return (
    <div className="preview-panel">
      <div className="preview-placeholder">
        {isRecording ? (
          <>
            <p className="preview-placeholder-recording">
              ● 録画中... ブラウザで操作してください
            </p>
            <p className="preview-placeholder-text">
              {recordedStepCount} ステップ記録済み
            </p>
          </>
        ) : (
          <>
            <p className="preview-placeholder-text">
              プレビューウィンドウで表示中
            </p>
            <p className="preview-placeholder-url">{url}</p>
          </>
        )}
      </div>
    </div>
  );
}
