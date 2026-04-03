import { useState, useRef, useEffect } from "react";

type MainView = "canvas" | "preview";

interface ToolbarProps {
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  onAddNode: () => void;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  urlHistory: string[];
  onDeleteUrlHistory: (url: string) => void;
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
  urlHistory,
  onDeleteUrlHistory,
  mainView,
  onMainViewChange,
  isRecording,
  isAssertMode,
  onStartRecording,
  onStopRecording,
  onToggleAssertMode,
  canRecord,
}: ToolbarProps) {
  const [showUrlDropdown, setShowUrlDropdown] = useState(false);
  const urlComboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showUrlDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (urlComboRef.current && !urlComboRef.current.contains(e.target as Node)) {
        setShowUrlDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showUrlDropdown]);

  const filteredHistory = urlHistory;
  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <img src="/logo.svg" alt="" className="toolbar-logo" />
        <span className="toolbar-title">Storywright</span>
        <div className="toolbar-tabs">
          <button
            className={`toolbar-tab ${mainView === "preview" ? "active" : ""}`}
            type="button"
            onClick={() => onMainViewChange("preview")}
          >
            Preview
          </button>
          <button
            className={`toolbar-tab ${mainView === "canvas" ? "active" : ""}`}
            type="button"
            onClick={() => onMainViewChange("canvas")}
          >
            Canvas
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
        <div className="url-combobox" ref={urlComboRef}>
          <input
            className="toolbar-url-input"
            value={baseUrl}
            onChange={(e) => {
              onBaseUrlChange(e.target.value);
              setShowUrlDropdown(true);
            }}
            onFocus={() => setShowUrlDropdown(true)}
            placeholder="Base URL"
          />
          {showUrlDropdown && filteredHistory.length > 0 && (
            <div className="url-dropdown">
              {filteredHistory.map((url) => (
                <div key={url} className="url-dropdown-item">
                  <button
                    className="url-dropdown-label"
                    type="button"
                    onClick={() => {
                      onBaseUrlChange(url);
                      setShowUrlDropdown(false);
                    }}
                  >
                    {url}
                  </button>
                  <button
                    className="url-dropdown-delete"
                    type="button"
                    title="履歴から削除"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteUrlHistory(url);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
              title={canRecord ? "録画開始" : "Base URL を入力してください"}
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
