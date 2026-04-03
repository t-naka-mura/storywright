const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("storywright", {
  runStory: (storyJson: string, keepSession?: boolean) =>
    ipcRenderer.invoke("run-story", storyJson, keepSession),
  runStoryRepeat: (storyJson: string, repeatCount: number, keepSession?: boolean) =>
    ipcRenderer.invoke("run-story-repeat", storyJson, repeatCount, keepSession),
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
});
