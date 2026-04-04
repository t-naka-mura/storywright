import { useState } from "react";
import type { Step } from "../types";
import { ACTION_OPTIONS } from "../types";
import { extractEnvironmentVariableNames } from "../lib/environmentRequirements";

interface StepEditorProps {
  step: Step;
  onSave: (step: Step) => void;
  onCancel: () => void;
  onDelete: () => void;
  onOpenSettings?: () => void;
}

export function StepEditor({ step, onSave, onCancel, onDelete, onOpenSettings }: StepEditorProps) {
  const [draft, setDraft] = useState<Step>({ ...step });

  const needsTarget = draft.action !== "navigate" && draft.action !== "screenshot";
  const needsValue =
    draft.action === "navigate" ||
    draft.action === "type" ||
    draft.action === "select" ||
    draft.action === "assert" ||
    draft.action === "wait";
  const referencedVariables = Array.from(
    new Set([
      ...extractEnvironmentVariableNames(draft.target),
      ...extractEnvironmentVariableNames(draft.value),
    ]),
  );
  const shouldSuggestSensitive = draft.action === "type" && referencedVariables.length > 0 && !draft.sensitive;

  return (
    <div className="step-editor">
      <div className="step-editor-field">
        <label className="step-editor-label">Action</label>
        <select
          className="step-editor-select"
          value={draft.action}
          onChange={(e) =>
            setDraft({ ...draft, action: e.target.value as Step["action"] })
          }
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {needsTarget && (
        <div className="step-editor-field">
          <label className="step-editor-label">Target</label>
          <input
            className="step-editor-input"
            value={draft.target}
            onChange={(e) => setDraft({ ...draft, target: e.target.value })}
            placeholder="CSS selector"
          />
        </div>
      )}

      {needsValue && (
        <div className="step-editor-field">
          <label className="step-editor-label">
            {draft.action === "navigate" ? "URL" : "Value"}
          </label>
          <input
            className="step-editor-input"
            type={draft.sensitive && draft.action !== "navigate" ? "password" : "text"}
            value={draft.action === "navigate" ? draft.target : draft.value}
            onChange={(e) =>
              draft.action === "navigate"
                ? setDraft({ ...draft, target: e.target.value })
                : setDraft({ ...draft, value: e.target.value })
            }
            placeholder={
              draft.action === "navigate" ? "https://..." : "入力値・期待値"
            }
          />
        </div>
      )}

      {draft.action === "type" && (
        <>
          <div className="step-editor-field">
            <label className="step-editor-checkbox">
              <input
                type="checkbox"
                checked={draft.sensitive ?? false}
                onChange={(e) => setDraft({ ...draft, sensitive: e.target.checked || undefined })}
              />
              機密値（パスワード等）
            </label>
          </div>
          {shouldSuggestSensitive && (
            <div className="step-editor-sensitive-hint" role="note">
              <span className="step-editor-sensitive-hint-text">
                ENV 参照を含む入力は sensitive を有効にしておくと、一覧表示や export 時の扱いを揃えやすくなります。
              </span>
              <button
                className="step-editor-env-link"
                type="button"
                onClick={() => setDraft({ ...draft, sensitive: true })}
              >
                sensitive にする
              </button>
            </div>
          )}
        </>
      )}

      {referencedVariables.length > 0 && (
        <div className="step-editor-env-hint" role="note">
          <div className="step-editor-env-hint-text">
            Uses {referencedVariables.map((name) => `LOCAL_ENV.${name}`).join(", ")}
          </div>
          {onOpenSettings && (
            <button className="step-editor-env-link" type="button" onClick={onOpenSettings}>
              Settings を開く
            </button>
          )}
        </div>
      )}

      <div className="step-editor-actions">
        <button className="btn btn-sm btn-primary" type="button" onClick={() => onSave(draft)}>
          Save
        </button>
        <button className="btn btn-sm" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-sm btn-danger" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
