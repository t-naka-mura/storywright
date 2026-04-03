interface ToolbarProps {
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  isRecording: boolean;
  isAssertMode: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleAssertMode: () => void;
  canRecord: boolean;
}

export function Toolbar({
  onTogglePanel,
  isPanelOpen,
  isRecording,
  isAssertMode,
  onStartRecording,
  onStopRecording,
  onToggleAssertMode,
  canRecord,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <img src="/logo.svg" alt="" className="toolbar-logo" />
        <span className="toolbar-title">Storywright</span>
        {/* ADR-015: Canvas タブ・Import ボタンは一時非表示 */}
      </div>
      <div className="toolbar-right">
        {isRecording ? (
            <>
              <button
                className="btn btn-rec btn-rec-active"
                type="button"
                onClick={onStopRecording}
              >
                ■ Stop
              </button>
              <button
                className={`btn btn-assert ${isAssertMode ? "btn-assert-active" : ""}`}
                type="button"
                onClick={onToggleAssertMode}
                title="要素をクリックしてアサーションを追加"
              >
                ✓ Assert
              </button>
            </>
          ) : (
            <button
              className="btn btn-rec"
              type="button"
              onClick={onStartRecording}
              disabled={!canRecord}
              title={canRecord ? "録画開始" : "URL を入力してください"}
            >
              ● REC
            </button>
          )
        }
        <button className="btn" type="button" onClick={onTogglePanel}>
          {isPanelOpen ? "▷" : "◁"} Panel
        </button>
      </div>
    </header>
  );
}
