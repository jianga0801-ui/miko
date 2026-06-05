import { app, BrowserWindow, ipcMain } from "electron"
import { join } from "node:path"
import { createMikoServer } from "@miko-ai/sdk"

let server: { url: string; close(): void } | undefined

async function bootstrap() {
  server = await createMikoServer({ hostname: "127.0.0.1" })

  ipcMain.on("miko:server-url", (event) => {
    event.returnValue = server!.url
  })

  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    webPreferences: { preload: join(__dirname, "../preload/index.js") },
  })

  if (process.env["ELECTRON_RENDERER_URL"]) {
    await win.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    await win.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

app.whenReady().then(bootstrap)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
