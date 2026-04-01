const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("storywright", {
  runStory: (storyJson: string) => ipcRenderer.invoke("run-story", storyJson),
  openPreview: (url: string) => ipcRenderer.invoke("open-preview", url),
  closePreview: () => ipcRenderer.invoke("close-preview"),
  startRecording: (url: string) => ipcRenderer.invoke("start-recording", url),
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
});
