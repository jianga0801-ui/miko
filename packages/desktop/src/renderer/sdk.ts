/// <reference path="../preload/index.d.ts" />
import { createMikoClient } from "@miko-ai/sdk/client"

export const client = createMikoClient({ baseUrl: window.miko.serverUrl })
