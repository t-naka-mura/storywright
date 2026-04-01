type MainView = "canvas" | "preview";

interface ToolbarProps {
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  onAddNode: () => void;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
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
  onAddNode,
  baseUrl,
  onBaseUrlChange,
  mainView,
  onMainViewChange,
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
        <span className="toolbar-title">Storywright</span>
        <div className="toolbar-tabs">
          <button
            className={`toolbar-tab ${mainView === "canvas" ? "active" : ""}`}
            type="button"
            onClick={() => onMainViewChange("canvas")}
          >
            Canvas
          </button>
          <button
            className={`toolbar-tab ${mainView === "preview" ? "active" : ""}`}
            type="button"
            onClick={() => onMainViewChange("preview")}
          >
            Preview
          </button>
        </div>
        <button className="btn" type="button" onClick={onAddNode}>
          + 画面追加
        </button>
        <button className="btn" type="button">
          Import
        </button>
      </div>
      <div className="toolbar-right">
        <input
          className="toolbar-url-input"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder="Base URL"
        />
        {mainView === "preview" && (
          isRecording ? (
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
              title={canRecord ? "録画開始" : "ストーリーを選択してください"}
            >
              ● REC
            </button>
          )
        )}
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
