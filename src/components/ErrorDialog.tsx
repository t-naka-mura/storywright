interface ErrorDialogProps {
  title: string;
  message: string;
  onClose: () => void;
}

export function ErrorDialog({ title, message, onClose }: ErrorDialogProps) {
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
          <button className="btn btn-primary" type="button" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
