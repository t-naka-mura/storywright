interface StatusBarProps {
  nodeCount: number;
  edgeCount: number;
}

export function StatusBar({ nodeCount, edgeCount }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-item">
        <span className="status-dot" />
        Ready
      </div>
      <div className="status-item">画面: {nodeCount}</div>
      <div className="status-item">ストーリー: {edgeCount}</div>
    </footer>
  );
}
