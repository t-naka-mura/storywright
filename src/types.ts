export interface Step {
  id: string;
  order: number;
  action: "navigate" | "click" | "type" | "select" | "assert" | "wait" | "screenshot" | "activate-tab";
  target: string;
  value: string;
  valueRef?: string;
  description: string;
  sensitive?: boolean;
}

export interface StoryMetadata {
  createdAt: number;
  updatedAt?: number;
}

export interface Story {
  id: string;
  title: string;
  baseUrl?: string;
  steps: Step[];
  metadata: StoryMetadata;
  createdAt?: number; // legacy field for migration compatibility
}

export interface StoryDocument {
  schemaVersion: 1;
  stories: Record<string, Story>;
  exportedAt?: string;
}

export interface EnvironmentDomainValue {
  key: string;
  value: string;
}

export interface EnvironmentDomain {
  id: string;
  name: string;
  matchHost: string;
  values: EnvironmentDomainValue[];
}

export interface EnvironmentSettings {
  domains?: EnvironmentDomain[];
  activeDomainId?: string;
}

export interface ImportedEnvironmentValues {
  filePath: string;
  values: EnvironmentDomainValue[];
}

export interface EnvironmentSourceStatus {
  mode: "process-env" | "domain-values";
  loadedVariableCount: number;
  inlineValueCount: number;
  error?: string;
}

export type LocalStateKey = "urlHistory" | "environment";
export type AppView = "story" | "settings";

export type EnvironmentPresenceMap = Record<string, boolean>;

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
  action: "navigate" | "click" | "type" | "select" | "assert" | "activate-tab";
  target: string;
  value: string;
  timestamp: number;
  sensitive?: boolean;
}

export type StepProgress = {
  storyId: string;
  order: number;
  status: "running" | "passed" | "failed" | "skipped";
  durationMs: number;
  error?: string;
};

export type PreviewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PreviewTabState = {
  id: string;
  title: string;
  url: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
};

export type PreviewState = {
  tabs: PreviewTabState[];
  activeTabId: string | null;
};

// Electron IPC bridge
export interface StorywrightAPI {
  saveStories: (data: StoryDocument) => Promise<void>;
  loadStories: () => Promise<unknown>;
  exportStoriesToFile: (data: StoryDocument, suggestedFileName?: string) => Promise<string | null>;
  importStoriesFromFile: () => Promise<unknown | null>;
  saveLocalState: (key: LocalStateKey, data: unknown) => Promise<void>;
  loadLocalState: (key: LocalStateKey) => Promise<unknown>;
  getEnvironmentVariablePresence: (names: string[], url?: string) => Promise<EnvironmentPresenceMap>;
  getEnvironmentSourceStatus: () => Promise<EnvironmentSourceStatus>;
  openSettingsWindow: () => Promise<void>;
  openHelpWindow: () => Promise<void>;
  closeCurrentWindow: () => Promise<void>;
  toggleCurrentWindowZoom: () => Promise<void>;
  importEnvironmentFile: () => Promise<ImportedEnvironmentValues | null>;
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
  getPreviewState: () => Promise<PreviewState>;
  setPreviewBounds: (bounds: PreviewBounds) => Promise<void>;
  createPreviewTab: (url?: string) => Promise<void>;
  closePreviewTab: (tabId: string) => Promise<void>;
  activatePreviewTab: (tabId: string) => Promise<void>;
  loadPreviewUrl: (url: string) => Promise<void>;
  previewGoBack: () => Promise<void>;
  previewGoForward: () => Promise<void>;
  previewReload: () => Promise<void>;
  previewFindInPage: (text: string, forward: boolean) => Promise<void>;
  previewStopFindInPage: () => Promise<void>;
  triggerExportStories: () => Promise<void>;
  triggerImportStories: () => Promise<void>;
  onRequestExport: (callback: () => void) => () => void;
  onRequestImport: (callback: () => void) => () => void;
  showErrorDialog: (title: string, message: string) => Promise<void>;
  onPreviewState: (callback: (state: PreviewState) => void) => () => void;
  onNewTab: (callback: (url: string) => void) => () => void;
  testGetPreviewBounds?: () => Promise<PreviewBounds>;
  testOpenSettings?: () => Promise<void>;
  testEvaluatePreview?: (script: string) => Promise<unknown>;
  testExportToFile?: (data: unknown, filePath: string) => Promise<string>;
  testImportFromFile?: (filePath: string) => Promise<unknown>;
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
