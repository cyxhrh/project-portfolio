const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aiIntel", {
  getStatus: () => ipcRenderer.invoke("status:get"),
  runNow: () => ipcRenderer.invoke("auto:run"),
  setTaskTime: (time) => ipcRenderer.invoke("task:setTime", time),
  taskStatus: () => ipcRenderer.invoke("task:status"),
  taskEnable: () => ipcRenderer.invoke("task:enable"),
  taskDisable: () => ipcRenderer.invoke("task:disable"),
  openUrl: (url) => ipcRenderer.invoke("open:url", url),
  openPath: (target) => ipcRenderer.invoke("open:path", target),
  onRunLog: (callback) => ipcRenderer.on("auto:log", (_event, data) => callback(data)),
  onRunning: (callback) => ipcRenderer.on("auto:running", (_event, data) => callback(data))
});
