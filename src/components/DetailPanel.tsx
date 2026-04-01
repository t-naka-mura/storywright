import type { Edge } from "@xyflow/react";

interface Step {
  order: number;
  action: string;
  target: string;
  value?: string;
}

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEdge: Edge | null;
}

const dummySteps: Record<string, { title: string; steps: Step[] }> = {
  "login-flow": {
    title: "ログインフロー",
    steps: [
      { order: 1, action: "navigate", target: "/login" },
      { order: 2, action: "type", target: "#email", value: "test@example.com" },
      { order: 3, action: "type", target: "#password", value: "********" },
      { order: 4, action: "click", target: ".submit-btn" },
      { order: 5, action: "assert", target: ".dashboard-title", value: "ダッシュボード" },
    ],
  },
  "signup-flow": {
    title: "新規登録フロー",
    steps: [
      { order: 1, action: "navigate", target: "/signup" },
      { order: 2, action: "type", target: "#name", value: "テスト太郎" },
      { order: 3, action: "type", target: "#email", value: "test@example.com" },
      { order: 4, action: "click", target: ".register-btn" },
      { order: 5, action: "assert", target: ".welcome", value: "ようこそ" },
    ],
  },
};

export function DetailPanel({ isOpen, onClose, selectedEdge }: DetailPanelProps) {
  const story = selectedEdge ? dummySteps[selectedEdge.id] : null;

  return (
    <aside className={`detail-panel${isOpen ? "" : " collapsed"}`}>
      <div className="panel-header">
        <span className="panel-header-title">
          {story ? story.title : "ストーリー詳細"}
        </span>
        <button className="panel-toggle" type="button" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="panel-body">
        {story ? (
          <ol className="step-list">
            {story.steps.map((step) => (
              <li key={step.order} className="step-item">
                <span className="step-order">{step.order}</span>
                <div className="step-content">
                  <span className="step-action">{step.action}</span>
                  <span className="step-detail">
                    {step.target}
                    {step.value ? ` → ${step.value}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="panel-empty">
            エッジ（ストーリー）をクリックすると
            <br />
            ステップが表示されます
          </p>
        )}
      </div>

      {story && (
        <div className="panel-actions">
          <button className="btn btn-primary" type="button">
            ▶ Run
          </button>
          <button className="btn" type="button">
            Edit
          </button>
        </div>
      )}
    </aside>
  );
}
