export interface Step {
  order: number;
  action: "navigate" | "click" | "type" | "select" | "assert" | "wait" | "screenshot";
  target: string;
  value: string;
  description: string;
}

export interface Story {
  id: string;
  title: string;
  baseUrl?: string;
  steps: Step[];
}

export type StepResult = {
  order: number;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: string;
};

export type StoryResult = {
  storyId: string;
  status: "passed" | "failed";
  stepResults: StepResult[];
};

export interface RecordedStep {
  action: "navigate" | "click" | "type";
  target: string;
  value: string;
  timestamp: number;
}

// Electron IPC bridge
export interface StorywrightAPI {
  runStory: (storyJson: string) => Promise<StoryResult>;
  openPreview: (url: string) => Promise<void>;
  closePreview: () => Promise<void>;
  startRecording: (url: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  onRecorderStep: (callback: (step: RecordedStep) => void) => () => void;
}

declare global {
  interface Window {
    storywright: StorywrightAPI;
  }
}

export const ACTION_OPTIONS: { value: Step["action"]; label: string }[] = [
  { value: "navigate", label: "navigate" },
  { value: "click", label: "click" },
  { value: "type", label: "type" },
  { value: "select", label: "select" },
  { value: "assert", label: "assert" },
  { value: "wait", label: "wait" },
  { value: "screenshot", label: "screenshot" },
];
