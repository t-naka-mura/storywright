interface ToolbarProps {
  onTogglePanel: () => void;
  isPanelOpen: boolean;
}

export function Toolbar({ onTogglePanel, isPanelOpen }: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">Storywright</span>
        <button className="btn" type="button">
          + 画面追加
        </button>
        <button className="btn" type="button">
          + ストーリー追加
        </button>
        <button className="btn" type="button">
          Import
        </button>
      </div>
      <div className="toolbar-right">
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
