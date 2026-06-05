import { app, BrowserWindow, dialog, ipcMain } from "electron"
import { join } from "node:path"
import { createMikoServer } from "@miko-ai/sdk"

let server: { url: string; close(): void } | undefined

async function bootstrap() {
  ipcMain.on("miko:server-url", (event) => {
    event.returnValue = server?.url ?? ""
  })

  server = await createMikoServer({ hostname: "127.0.0.1" })

  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      sandbox: true,
    },
  })

  if (process.env["ELECTRON_RENDERER_URL"]) {
    await win.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    await win.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

app.whenReady().then(bootstrap).catch((err) => {
  dialog.showErrorBox("Failed to start miko server", String(err))
  app.quit()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("before-quit", () => {
  server?.close()
  server = undefined
})
