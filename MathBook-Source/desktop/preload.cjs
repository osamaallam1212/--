const { contextBridge, ipcRenderer } = require("electron");

const CALLS = new Set([
  "ready", "pick-files", "pick-folder", "setFullscreen", "setChrome", "openExternal", "appInfo", "exitApp", "keepAwake",
  "notifyPermission", "requestNotifyPermission", "notifySchedule", "notifyTest", "setBackgroundMode", "micPermission",
  "download", "download-cleanup", "saveTextFile", "openTextFile", "pick-any", "save-binary",
]);
const EVENTS = new Set(["back", "notification-click", "fullscreen-changed", "download-progress", "window-focus", "open-page"]);

contextBridge.exposeInMainWorld("kalimatiDesktop", {
  invoke: (name, args) => (CALLS.has(name) ? ipcRenderer.invoke(name, args) : Promise.reject(new Error("unknown call " + name))),
  on: (event, cb) => {
    if (!EVENTS.has(event)) return () => {};
    const fn = (_e, data) => cb(data);
    ipcRenderer.on(event, fn);
    return () => ipcRenderer.removeListener(event, fn);
  },
});
