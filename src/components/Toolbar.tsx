import { StopIcon, CheckIcon, RecordIcon } from "./Icons";

interface ToolbarProps {
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  isRecording: boolean;
  isAssertMode: boolean;
  onImportStories: () => void;
  onExportAllStories: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleAssertMode: () => void;
  canRecord: boolean;
  canExportStories: boolean;
  onOpenHelp: () => void;
}

export function Toolbar({
  onTogglePanel,
  isPanelOpen,
  isRecording,
  isAssertMode,
  onImportStories,
  onExportAllStories,
  onStartRecording,
  onStopRecording,
  onToggleAssertMode,
  canRecord,
  canExportStories,
  onOpenHelp,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <img src="/logo.svg" alt="" className="toolbar-logo" />
        <span className="toolbar-title">Storywright</span>
      </div>
      <div className="toolbar-right">
        <button className="btn" type="button" onClick={onImportStories}>
          Import
        </button>
        <button className="btn" type="button" onClick={onExportAllStories} disabled={!canExportStories}>
          Export All
        </button>
        {isRecording ? (
            <>
              <button
                className="btn btn-rec btn-rec-active"
                type="button"
                onClick={onStopRecording}
              >
                <StopIcon /> Stop
              </button>
              <button
                className={`btn btn-assert ${isAssertMode ? "btn-assert-active" : ""}`}
                type="button"
                onClick={onToggleAssertMode}
                title="要素をクリックしてアサーションを追加"
              >
                <CheckIcon /> Assert
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
              <RecordIcon /> REC
            </button>
          )}
        <button className="btn btn-help" type="button" onClick={onOpenHelp} title="ヘルプ">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6.5 7a2.5 2.5 0 0 1 4.85.83c0 1.25-1.6 1.67-1.85 2.67" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="9" cy="13.5" r="0.75" fill="currentColor" />
          </svg>
        </button>
        <button className="btn btn-panel-toggle" type="button" onClick={onTogglePanel} title={isPanelOpen ? "パネルを閉じる" : "パネルを開く"}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1.5" y="2" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <line x1={isPanelOpen ? "11.5" : "6.5"} y1="2" x2={isPanelOpen ? "11.5" : "6.5"} y2="16" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </header>
  );
}
