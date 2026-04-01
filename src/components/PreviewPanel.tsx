interface PreviewPanelProps {
  url: string;
  isRecording: boolean;
  recordedStepCount: number;
}

export function PreviewPanel({ url, isRecording, recordedStepCount }: PreviewPanelProps) {
  const hasUrl = url && /^https?:\/\//.test(url);

  return (
    <div className="preview-panel">
      {isRecording && (
        <div className="preview-recording-badge">
          ● 録画中 — {recordedStepCount} ステップ記録済み
        </div>
      )}
      {hasUrl ? (
        <webview
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
