interface StatusBarProps {
  nodeCount: number;
  edgeCount: number;
  isRecording: boolean;
}

export function StatusBar({ nodeCount, edgeCount, isRecording }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-item">
        {isRecording ? (
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
