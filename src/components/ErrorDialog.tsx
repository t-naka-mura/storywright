import type { EnvironmentSetupGuide } from "../lib/environmentRequirements";

interface ErrorDialogProps {
  title: string;
  message: string;
  onClose: () => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  setupGuide?: EnvironmentSetupGuide;
}

export function ErrorDialog({ title, message, onClose, primaryActionLabel, onPrimaryAction, setupGuide }: ErrorDialogProps) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-icon">!</span>
          <span className="dialog-title">{title}</span>
        </div>
        <div className="dialog-body">
          <pre className="dialog-message">{message}</pre>
          {setupGuide && (
            <section className="dialog-setup-guide" aria-label="Setup guide">
              <div className="dialog-setup-guide-title">Setup guide</div>
              <div className="dialog-setup-guide-subtitle">Required environment variables</div>
              <ul className="dialog-setup-guide-list">
                {setupGuide.requirements.map((requirement) => (
                  <li key={requirement} className="dialog-setup-guide-item">
                    {requirement}
                  </li>
                ))}
              </ul>
              <p className="dialog-setup-guide-footer">{setupGuide.footer}</p>
            </section>
          )}
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
