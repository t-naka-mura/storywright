import { useState, useRef, useEffect } from "react";
import type { Story, Step, StoryResult, RepeatResult } from "../types";
import { StepEditor } from "./StepEditor";

interface DetailPanelProps {
  isOpen: boolean;
  story: Story | null;
  storyResult: StoryResult | null;
  onUpdateStory: (story: Story) => void;
  onRunStory: (story: Story, keepSession: boolean) => void;
  onRunStoryRepeat: (story: Story, repeatCount: number, keepSession: boolean) => void;
  onCancelRun: () => void;
  onCancelRepeat: () => void;
  isRunning: boolean;
  repeatProgress: { current: number; total: number } | null;
  repeatResult: RepeatResult | null;
  standaloneStories: Story[];
  storyResults: Record<string, StoryResult>;
  onSelectStory?: (storyId: string) => void;
  onDeselectStory?: () => void;
  onDeleteStory?: (storyId: string) => void;
}

function createEmptyStep(order: number): Step {
  return { order, action: "click", target: "", value: "", description: "" };
}

function renumberSteps(steps: Step[]): Step[] {
  return steps.map((s, i) => ({ ...s, order: i + 1 }));
}

export function DetailPanel({
  isOpen,
  story,
  storyResult,
  onUpdateStory,
  onRunStory,
  onRunStoryRepeat,
  onCancelRun,
  onCancelRepeat,
  isRunning,
  repeatProgress,
  repeatResult,
  standaloneStories,
  storyResults,
  onSelectStory,
  onDeselectStory,
  onDeleteStory,
}: DetailPanelProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);
  const [showRepeatPopover, setShowRepeatPopover] = useState(false);
  const [repeatCount, setRepeatCount] = useState(10);
  const [keepSession, setKeepSession] = useState(false);
  const dragCounter = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!showRepeatDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRepeatDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showRepeatDropdown]);

  const handleAddStep = () => {
    if (!story) return;
    const newStep = createEmptyStep(story.steps.length + 1);
    const updated = { ...story, steps: [...story.steps, newStep] };
    onUpdateStory(updated);
    setEditingIndex(story.steps.length);
  };

  const handleInsertStep = (atIndex: number) => {
    if (!story) return;
    const newStep = createEmptyStep(0);
    const steps = [...story.steps];
    steps.splice(atIndex, 0, newStep);
    onUpdateStory({ ...story, steps: renumberSteps(steps) });
    setEditingIndex(atIndex);
  };

  const handleDuplicateStep = (index: number) => {
    if (!story) return;
    const original = story.steps[index];
    const copy = { ...original, order: 0, description: original.description };
    const steps = [...story.steps];
    steps.splice(index + 1, 0, copy);
    onUpdateStory({ ...story, steps: renumberSteps(steps) });
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

  // --- Drag & Drop ---

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIndex !== null && index !== dragIndex) {
      setDropTargetIndex(index);
    }
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragIndex !== null && index !== dragIndex) {
      setDropTargetIndex(index);
    }
  };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDropTargetIndex(null);
      dragCounter.current = 0;
    }
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    dragCounter.current = 0;
    if (!story || dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null);
      setDropTargetIndex(null);
      return;
    }
    const steps = [...story.steps];
    const [moved] = steps.splice(dragIndex, 1);
    steps.splice(toIndex, 0, moved);
    onUpdateStory({ ...story, steps: renumberSteps(steps) });
    setDragIndex(null);
    setDropTargetIndex(null);
    setEditingIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropTargetIndex(null);
    dragCounter.current = 0;
  };

  return (
    <aside className={`detail-panel${isOpen ? "" : " collapsed"}`}>
      <div className="panel-header">
        {story && onDeselectStory && (
          <button className="panel-back" type="button" onClick={onDeselectStory} title="ストーリー一覧に戻る">
            ←
          </button>
        )}
        {story && editingTitle ? (
          <input
            className="panel-header-title-input"
            value={story.title}
            onChange={(e) => onUpdateStory({ ...story, title: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
            autoFocus
          />
        ) : (
          <span
            className="panel-header-title"
            onClick={() => story && setEditingTitle(true)}
            title={story ? "クリックでリネーム" : undefined}
          >
            {story ? story.title : "ストーリー"}
          </span>
        )}
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
                  <li key={`${step.order}-${index}`}>
                    {/* 中間挿入ボタン */}
                    <div className="step-insert-zone">
                      <button
                        className="btn-insert"
                        type="button"
                        onClick={() => handleInsertStep(index)}
                      >
                        + 挿入
                      </button>
                    </div>
                    {editingIndex === index ? (
                      <StepEditor
                        step={step}
                        onSave={(s) => handleUpdateStep(index, s)}
                        onCancel={() => setEditingIndex(null)}
                        onDelete={() => handleDeleteStep(index)}
                      />
                    ) : (
                      <div
                        className={`step-item ${result ? `step-${result.status}` : ""} ${dragIndex === index ? "step-dragging" : ""} ${dropTargetIndex === index ? "step-drop-target" : ""}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnter={(e) => handleDragEnter(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <span className="step-drag-handle" title="ドラッグで並び替え">⠿</span>
                        <span className={`step-order ${result ? `step-order-${result.status}` : ""}`}>
                          {result?.status === "passed"
                            ? "✓"
                            : result?.status === "failed"
                              ? "✗"
                              : step.order}
                        </span>
                        <div className="step-content" onClick={() => setEditingIndex(index)}>
                          <span className="step-action">{step.action}</span>
                          <span className="step-detail">
                            {step.target}
                            {step.value ? ` → ${step.value}` : ""}
                          </span>
                          {result?.error && (
                            <span className="step-error">{result.error}</span>
                          )}
                        </div>
                        <button
                          className="btn-duplicate"
                          type="button"
                          title="ステップを複製"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateStep(index);
                          }}
                        >
                          ⧉
                        </button>
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
          <div className="panel-empty-area">
            <p className="panel-empty">
              ● REC を押して録画を開始するか、
              <br />
              録画済みストーリーを選択してください
            </p>
            {standaloneStories.length > 0 && (
              <div className="standalone-story-list">
                <div className="story-list-header">
                  <label className="panel-field-label">録画済みストーリー</label>
                  <select
                    className="story-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "name")}
                  >
                    <option value="newest">新しい順</option>
                    <option value="oldest">古い順</option>
                    <option value="name">名前順</option>
                  </select>
                </div>
                {[...standaloneStories].sort((a, b) => {
                  if (sortBy === "name") return a.title.localeCompare(b.title);
                  const aTime = a.createdAt ?? 0;
                  const bTime = b.createdAt ?? 0;
                  return sortBy === "newest" ? bTime - aTime : aTime - bTime;
                }).map((s) => {
                  const result = storyResults[s.id];
                  return (
                  <div key={s.id} className="standalone-story-item">
                    <button
                      className="standalone-story-select"
                      type="button"
                      onClick={() => onSelectStory?.(s.id)}
                    >
                      {result && (
                        <span className={`story-badge story-badge-${result.status}`}>
                          {result.status === "passed" ? "✓" : "✗"}
                        </span>
                      )}
                      <span className="standalone-story-title">{s.title}</span>
                      <span className="standalone-story-meta">{s.steps.length} ステップ</span>
                    </button>
                    {onDeleteStory && (
                      <button
                        className="standalone-story-delete"
                        type="button"
                        title="ストーリーを削除"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteStory(s.id);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {story && (
        <div className="panel-actions">
          <label className="panel-checkbox">
            <input
              type="checkbox"
              checked={keepSession}
              onChange={(e) => setKeepSession(e.target.checked)}
              disabled={isRunning}
            />
            セッションを維持
          </label>
          {repeatResult && !isRunning && (
            <div className="repeat-summary">
              {repeatResult.failedIterations === 0
                ? `✅ ${repeatResult.passedIterations}/${repeatResult.totalIterations} passed`
                : `⚠️ ${repeatResult.passedIterations}/${repeatResult.totalIterations} passed, ${repeatResult.failedIterations} failed`}
            </div>
          )}
          {isRunning && repeatProgress ? (
            <button
              className="btn btn-danger"
              type="button"
              onClick={onCancelRepeat}
            >
              ⏳ Running ({repeatProgress.current}/{repeatProgress.total})... ■ Stop
            </button>
          ) : isRunning ? (
            <button
              className="btn btn-danger"
              type="button"
              onClick={onCancelRun}
            >
              ⏳ Running... ■ Stop
            </button>
          ) : (
            <div className="split-button" ref={dropdownRef}>
              <button
                className="btn btn-primary split-button-main"
                type="button"
                onClick={() => onRunStory(story, keepSession)}
                disabled={story.steps.length === 0}
              >
                ▶ Run
              </button>
              <button
                className="btn btn-primary split-button-toggle"
                type="button"
                onClick={() => setShowRepeatDropdown((v) => !v)}
                disabled={isRunning || story.steps.length === 0}
              >
                ▼
              </button>
              {showRepeatDropdown && (
                <div className="split-button-dropdown">
                  <button
                    className="split-button-dropdown-item"
                    type="button"
                    onClick={() => {
                      setShowRepeatDropdown(false);
                      setShowRepeatPopover(true);
                    }}
                  >
                    🔁 繰り返し実行...
                  </button>
                </div>
              )}
              {showRepeatPopover && (
                <div className="repeat-popover">
                  <label className="repeat-popover-label">
                    繰り返し回数:
                  </label>
                  <input
                    className="repeat-popover-input"
                    type="number"
                    min={2}
                    max={1000}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Math.max(2, Number(e.target.value)))}
                    autoFocus
                  />
                  <span className="repeat-popover-unit">回</span>
                  <div className="repeat-popover-actions">
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => setShowRepeatPopover(false)}
                    >
                      キャンセル
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => {
                        setShowRepeatPopover(false);
                        onRunStoryRepeat(story, repeatCount, keepSession);
                      }}
                    >
                      ▶ 実行
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
