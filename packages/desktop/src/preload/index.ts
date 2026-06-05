import { contextBridge, ipcRenderer } from "electron"

const serverUrl: string = ipcRenderer.sendSync("miko:server-url")

contextBridge.exposeInMainWorld("miko", { serverUrl })
