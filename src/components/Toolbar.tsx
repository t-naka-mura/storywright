type MainView = "canvas" | "preview";

interface ToolbarProps {
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  onAddNode: () => void;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  mainView: MainView;
  onMainViewChange: (view: MainView) => void;
}

export function Toolbar({
  onTogglePanel,
  isPanelOpen,
  onAddNode,
  baseUrl,
  onBaseUrlChange,
  mainView,
  onMainViewChange,
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
