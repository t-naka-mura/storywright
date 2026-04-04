const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("storywright", {
  saveStories: (data: unknown) =>
    ipcRenderer.invoke("stories:save", data),
  loadStories: () =>
    ipcRenderer.invoke("stories:load"),
  exportStoriesToFile: (data: unknown, suggestedFileName?: string) =>
    ipcRenderer.invoke("stories:export", data, suggestedFileName),
  importStoriesFromFile: () =>
    ipcRenderer.invoke("stories:import"),
  getEnvironmentVariablePresence: (names: string[], url?: string) =>
    ipcRenderer.invoke("environment:get-presence", names, url),
  getEnvironmentSourceStatus: () =>
    ipcRenderer.invoke("environment:get-source-status"),
  openSettingsWindow: () =>
    ipcRenderer.invoke("app:open-settings"),
  closeCurrentWindow: () =>
    ipcRenderer.invoke("app:close-current-window"),
  toggleCurrentWindowZoom: () =>
    ipcRenderer.invoke("app:toggle-current-window-zoom"),
  importEnvironmentFile: () =>
    ipcRenderer.invoke("environment:import-file"),
  saveLocalState: (key: "urlHistory" | "environment", data: unknown) =>
    ipcRenderer.invoke("local-state:save", key, data),
  loadLocalState: (key: "urlHistory" | "environment") =>
    ipcRenderer.invoke("local-state:load", key),
  runStory: (storyJson: string, keepSession?: boolean) =>
    ipcRenderer.invoke("run-story", storyJson, keepSession),
  runStoryRepeat: (storyJson: string, repeatCount: number, keepSession?: boolean) =>
    ipcRenderer.invoke("run-story-repeat", storyJson, repeatCount, keepSession),
  cancelRun: () => ipcRenderer.invoke("cancel-run"),
  cancelRepeat: () => ipcRenderer.invoke("cancel-repeat"),
  startRecording: () => ipcRenderer.invoke("start-recording"),
  stopRecording: () => ipcRenderer.invoke("stop-recording"),
  toggleAssertMode: (enabled: boolean) => ipcRenderer.invoke("toggle-assert-mode", enabled),
  onRecorderStep: (callback: (step: unknown) => void) => {
    const listener = (_event: unknown, step: unknown) => callback(step);
    ipcRenderer.on("recorder:step", listener);
    return () => {
      ipcRenderer.removeListener("recorder:step", listener);
    };
  },
  onAssertDone: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("recorder:assert-done", listener);
    return () => {
      ipcRenderer.removeListener("recorder:assert-done", listener);
    };
  },
  onRepeatProgress: (callback: (progress: unknown) => void) => {
    const listener = (_event: unknown, progress: unknown) => callback(progress);
    ipcRenderer.on("repeat:progress", listener);
    return () => {
      ipcRenderer.removeListener("repeat:progress", listener);
    };
  },
  onStepProgress: (callback: (progress: unknown) => void) => {
    const listener = (_event: unknown, progress: unknown) => callback(progress);
    ipcRenderer.on("step:progress", listener);
    return () => {
      ipcRenderer.removeListener("step:progress", listener);
    };
  },
  getPreviewState: () => ipcRenderer.invoke("preview:get-state"),
  setPreviewBounds: (bounds: unknown) => ipcRenderer.invoke("preview:set-bounds", bounds),
  createPreviewTab: (url?: string) => ipcRenderer.invoke("preview:create-tab", url),
  closePreviewTab: (tabId: string) => ipcRenderer.invoke("preview:close-tab", tabId),
  activatePreviewTab: (tabId: string) => ipcRenderer.invoke("preview:activate-tab", tabId),
  loadPreviewUrl: (url: string) => ipcRenderer.invoke("preview:load-url", url),
  previewGoBack: () => ipcRenderer.invoke("preview:go-back"),
  previewGoForward: () => ipcRenderer.invoke("preview:go-forward"),
  previewReload: () => ipcRenderer.invoke("preview:reload"),
  onPreviewState: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on("preview:state", listener);
    return () => {
      ipcRenderer.removeListener("preview:state", listener);
    };
  },
  onNewTab: (callback: (url: string) => void) => {
    const listener = (_event: unknown, url: string) => callback(url);
    ipcRenderer.on("new-tab", listener);
    return () => {
      ipcRenderer.removeListener("new-tab", listener);
    };
  },
  testGetPreviewBounds: () => ipcRenderer.invoke("test:get-preview-bounds"),
  testOpenSettings: () => ipcRenderer.invoke("test:open-settings"),
  testEvaluatePreview: (script: string) => ipcRenderer.invoke("test:evaluate-preview", script),
});
