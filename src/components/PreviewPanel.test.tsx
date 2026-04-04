import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewPanel } from "./PreviewPanel";
import type { PreviewState, RepeatResult, StoryResult, StorywrightAPI } from "../types";

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

function createPreviewState(): PreviewState {
  return {
    tabs: [],
    activeTabId: null,
  };
}

function createStoryResult(): StoryResult {
  return {
    storyId: "story-1",
    status: "passed",
    stepResults: [],
  };
}

function createRepeatResult(): RepeatResult {
  return {
    storyId: "story-1",
    totalIterations: 0,
    completedIterations: 0,
    passedIterations: 0,
    failedIterations: 0,
    iterations: [],
  };
}

describe("PreviewPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const api: StorywrightAPI = {
      saveStories: vi.fn(async () => {}),
      loadStories: vi.fn(async () => null),
      exportStoriesToFile: vi.fn(async () => null),
      importStoriesFromFile: vi.fn(async () => null),
      getEnvironmentVariablePresence: vi.fn(async () => ({})),
      getEnvironmentSourceStatus: vi.fn(async () => ({ mode: "process-env" as const, loadedVariableCount: 0, inlineValueCount: 0 })),
      openSettingsWindow: vi.fn(async () => {}),
      closeCurrentWindow: vi.fn(async () => {}),
      importEnvironmentFile: vi.fn(async () => null),
      saveLocalState: vi.fn(async () => {}),
      loadLocalState: vi.fn(async () => null),
      runStory: vi.fn(async () => createStoryResult()),
      runStoryRepeat: vi.fn(async () => createRepeatResult()),
      cancelRun: vi.fn(async () => {}),
      cancelRepeat: vi.fn(async () => {}),
      startRecording: vi.fn(async () => {}),
      stopRecording: vi.fn(async () => {}),
      toggleAssertMode: vi.fn(async () => {}),
      onRecorderStep: vi.fn(() => vi.fn()),
      onAssertDone: vi.fn(() => vi.fn()),
      onRepeatProgress: vi.fn(() => vi.fn()),
      onStepProgress: vi.fn(() => vi.fn()),
      getPreviewState: vi.fn(async () => createPreviewState()),
      setPreviewBounds: vi.fn(async () => {}),
      createPreviewTab: vi.fn(async () => {}),
      closePreviewTab: vi.fn(async () => {}),
      activatePreviewTab: vi.fn(async () => {}),
      loadPreviewUrl: vi.fn(async () => {}),
      previewGoBack: vi.fn(async () => {}),
      previewGoForward: vi.fn(async () => {}),
      previewReload: vi.fn(async () => {}),
      onPreviewState: vi.fn(() => vi.fn()),
      onNewTab: vi.fn(() => vi.fn()),
    };

    window.storywright = api;
  });

  it("StrictMode の再 mount でも初期タブを 1 回しか作成しない", async () => {
    render(
      <StrictMode>
        <PreviewPanel
          url="https://example.com"
          isRecording={false}
          isRunning={false}
          recordedStepCount={0}
          onUrlChange={vi.fn()}
          urlHistory={[]}
          onDeleteUrlHistory={vi.fn()}
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(window.storywright.createPreviewTab).toHaveBeenCalledTimes(1);
    });
    expect(window.storywright.createPreviewTab).toHaveBeenCalledWith("https://example.com");
  });
});