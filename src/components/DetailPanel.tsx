import { useState } from "react";
import type { Story, Step, StoryResult } from "../types";
import { StepEditor } from "./StepEditor";

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  story: Story | null;
  storyResult: StoryResult | null;
  onUpdateStory: (story: Story) => void;
  onRunStory: (story: Story) => void;
  isRunning: boolean;
}

function createEmptyStep(order: number): Step {
  return { order, action: "click", target: "", value: "", description: "" };
}

export function DetailPanel({
  isOpen,
  onClose,
  story,
  storyResult,
  onUpdateStory,
  onRunStory,
  isRunning,
}: DetailPanelProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAddStep = () => {
    if (!story) return;
    const newStep = createEmptyStep(story.steps.length + 1);
    const updated = { ...story, steps: [...story.steps, newStep] };
    onUpdateStory(updated);
    setEditingIndex(story.steps.length);
  };

  const handleUpdateStep = (index: number, step: Step) => {
    if (!story) return;
    const steps = story.steps.map((s, i) => (i === index ? step : s));
    onUpdateStory({ ...story, steps });
    setEditingIndex(null);
  };

  const handleDeleteStep = (index: number) => {
    if (!story) return;
    const steps = story.steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, order: i + 1 }));
    onUpdateStory({ ...story, steps });
    setEditingIndex(null);
  };

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
          <>
            <div className="panel-field">
              <label className="panel-field-label">Base URL（空欄はグローバル設定を使用）</label>
              <input
                className="panel-field-input"
                value={story.baseUrl ?? ""}
                onChange={(e) =>
                  onUpdateStory({
                    ...story,
                    baseUrl: e.target.value || undefined,
                  })
                }
                placeholder="https://..."
              />
            </div>
            <ol className="step-list">
              {story.steps.map((step, index) => {
                const result = storyResult?.stepResults.find(
                  (r) => r.order === step.order,
                );
                return (
                  <li key={step.order}>
                    {editingIndex === index ? (
                      <StepEditor
                        step={step}
                        onSave={(s) => handleUpdateStep(index, s)}
                        onCancel={() => setEditingIndex(null)}
                        onDelete={() => handleDeleteStep(index)}
                      />
                    ) : (
                      <div
                        className={`step-item ${result ? `step-${result.status}` : ""}`}
                        onClick={() => setEditingIndex(index)}
                      >
                        <span className={`step-order ${result ? `step-order-${result.status}` : ""}`}>
                          {result?.status === "passed"
                            ? "✓"
                            : result?.status === "failed"
                              ? "✗"
                              : step.order}
                        </span>
                        <div className="step-content">
                          <span className="step-action">{step.action}</span>
                          <span className="step-detail">
                            {step.target}
                            {step.value ? ` → ${step.value}` : ""}
                          </span>
                          {result?.error && (
                            <span className="step-error">{result.error}</span>
                          )}
                        </div>
                        {result && (
                          <span className="step-duration">{result.durationMs}ms</span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <button
              className="btn btn-add-step"
              type="button"
              onClick={handleAddStep}
            >
              + ステップ追加
            </button>
          </>
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
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => onRunStory(story)}
            disabled={isRunning || story.steps.length === 0}
          >
            {isRunning ? "⏳ Running..." : "▶ Run"}
          </button>
        </div>
      )}
    </aside>
  );
}
