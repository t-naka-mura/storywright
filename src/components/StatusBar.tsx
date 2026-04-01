interface StatusBarProps {
  nodeCount: number;
  edgeCount: number;
  isRecording: boolean;
  isAssertMode: boolean;
}

export function StatusBar({ nodeCount, edgeCount, isRecording, isAssertMode }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-item">
        {isAssertMode ? (
          <>
            <span className="status-dot status-dot-assert" />
            Assert mode — 要素をクリックしてアサーションを追加
          </>
        ) : isRecording ? (
          <>
            <span className="status-dot status-dot-recording" />
            Recording...
          </>
        ) : (
          <>
            <span className="status-dot" />
            Ready
          </>
        )}
      </div>
      <div className="status-item">画面: {nodeCount}</div>
      <div className="status-item">ストーリー: {edgeCount}</div>
    </footer>
  );
}
