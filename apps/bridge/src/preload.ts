// 窓の中（renderer）に渡す口。contextIsolation を外さない・node をそのまま触らせない
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("bridge", {
  state: () => ipcRenderer.invoke("bridge:state"),
  claim: (code: string) => ipcRenderer.invoke("bridge:claim", code),
  check: () => ipcRenderer.invoke("bridge:check"),
  setBrowser: (b: string) => ipcRenderer.invoke("bridge:set-browser", b),
  installClaude: () => ipcRenderer.invoke("bridge:install-claude"),
  loginStart: () => ipcRenderer.invoke("bridge:login-start"),
  loginCode: (code: string) => ipcRenderer.invoke("bridge:login-code", code),
  loginCancel: () => ipcRenderer.invoke("bridge:login-cancel"),
  onInstallStep: (fn: (s: unknown) => void) => ipcRenderer.on("bridge:install-step", (_e, s) => fn(s)),
  openKaname: () => ipcRenderer.invoke("bridge:open-kaname"),
  stop: () => ipcRenderer.invoke("bridge:stop"),
  onLoop: (fn: (s: unknown) => void) => ipcRenderer.on("bridge:loop", (_e, s) => fn(s)),
  onBrowser: (fn: (b: string) => void) => ipcRenderer.on("bridge:browser", (_e, b) => fn(b)),
});
