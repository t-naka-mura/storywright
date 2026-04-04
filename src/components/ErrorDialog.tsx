interface ErrorDialogProps {
  title: string;
  message: string;
  onClose: () => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}

export function ErrorDialog({ title, message, onClose, primaryActionLabel, onPrimaryAction }: ErrorDialogProps) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-icon">!</span>
          <span className="dialog-title">{title}</span>
        </div>
        <div className="dialog-body">
          <pre className="dialog-message">{message}</pre>
        </div>
        <div className="dialog-footer">
          {primaryActionLabel && onPrimaryAction && (
            <button className="btn" type="button" onClick={onPrimaryAction}>
              {primaryActionLabel}
            </button>
          )}
          <button className="btn btn-primary" type="button" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
