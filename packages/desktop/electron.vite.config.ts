import { defineConfig } from "electron-vite"
import solid from "vite-plugin-solid"

export default defineConfig({
  main: { build: { rollupOptions: { input: "src/main/index.ts" } } },
  preload: { build: { rollupOptions: { input: "src/preload/index.ts" } } },
  renderer: {
    root: ".",
    build: { rollupOptions: { input: "index.html" } },
    plugins: [solid()],
  },
})
