const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("storywright", {
  runStory: (storyJson: string) => ipcRenderer.invoke("run-story", storyJson),
  openPreview: (url: string) => ipcRenderer.invoke("open-preview", url),
  closePreview: () => ipcRenderer.invoke("close-preview"),
});
