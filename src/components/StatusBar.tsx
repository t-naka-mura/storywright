interface StatusBarProps {
  isRecording: boolean;
  isAssertMode: boolean;
}

export function StatusBar({ isRecording, isAssertMode }: StatusBarProps) {
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
    </footer>
  );
}
