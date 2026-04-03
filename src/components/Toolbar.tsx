type MainView = "canvas" | "preview";

interface ToolbarProps {
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  onAddNode: () => void;
  mainView: MainView;
  onMainViewChange: (view: MainView) => void;
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
  onAddNode: _onAddNode,
  mainView: _mainView,
  onMainViewChange: _onMainViewChange,
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
        {/* Canvas タブは ADR-015 により一時非表示 */}
        <button className="btn" type="button">
          Import
        </button>
      </div>
      <div className="toolbar-right">
        {/* mainView は常に preview（ADR-015: Canvas 非表示中） */}
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
        <button className="btn btn-primary" type="button">
          ▶ Run All
        </button>
      </div>
    </header>
  );
}
