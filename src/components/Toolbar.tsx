import { StopIcon, CheckIcon, RecordIcon } from "./Icons";

interface ToolbarProps {
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  isRecording: boolean;
  isAssertMode: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleAssertMode: () => void;
  canRecord: boolean;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
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
  onOpenHelp,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <img src="/logo.svg" alt="" className="toolbar-logo" />
        <span className="toolbar-title">Storywright</span>
      </div>
      <div className="toolbar-right">
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
              title={canRecord ? "記録開始" : "URL を入力してください"}
            >
              <RecordIcon /> REC
            </button>
          )}
        <button className="btn btn-help" type="button" onClick={onOpenSettings} title="設定">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7.5 2.25h3l.4 1.6a5.5 5.5 0 0 1 1.3.75l1.55-.5 1.5 2.6-1.15 1.1a5.5 5.5 0 0 1 0 1.5l1.15 1.1-1.5 2.6-1.55-.5a5.5 5.5 0 0 1-1.3.75l-.4 1.6h-3l-.4-1.6a5.5 5.5 0 0 1-1.3-.75l-1.55.5-1.5-2.6 1.15-1.1a5.5 5.5 0 0 1 0-1.5l-1.15-1.1 1.5-2.6 1.55.5a5.5 5.5 0 0 1 1.3-.75l.4-1.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
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
