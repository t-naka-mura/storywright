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

export type RepeatResult = {
  storyId: string;
  totalIterations: number;
  completedIterations: number;
  passedIterations: number;
  failedIterations: number;
  iterations: StoryResult[];
};

export type RepeatProgress = {
  current: number;
  total: number;
  lastResult: StoryResult;
};

export interface RecordedStep {
  action: "navigate" | "click" | "type" | "select" | "assert";
  target: string;
  value: string;
  timestamp: number;
}

export type StepProgress = {
  storyId: string;
  order: number;
  status: "running" | "passed" | "failed" | "skipped";
  durationMs: number;
  error?: string;
};

// Electron IPC bridge
export interface StorywrightAPI {
  saveData: (filename: string, data: unknown) => Promise<void>;
  loadData: (filename: string) => Promise<unknown>;
  runStory: (storyJson: string, keepSession?: boolean) => Promise<StoryResult>;
  runStoryRepeat: (storyJson: string, repeatCount: number, keepSession?: boolean) => Promise<RepeatResult>;
  cancelRun: () => Promise<void>;
  cancelRepeat: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  toggleAssertMode: (enabled: boolean) => Promise<void>;
  onRecorderStep: (callback: (step: RecordedStep) => void) => () => void;
  onAssertDone: (callback: () => void) => () => void;
  onRepeatProgress: (callback: (progress: RepeatProgress) => void) => () => void;
  onStepProgress: (callback: (progress: StepProgress) => void) => () => void;
}

declare global {
  interface Window {
    storywright: StorywrightAPI;
  }
}

// Electron <webview> tag for JSX
declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        partition?: string;
        allowpopups?: boolean;
      },
      HTMLElement
    >;
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
