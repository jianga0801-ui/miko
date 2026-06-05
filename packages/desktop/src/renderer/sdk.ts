import { createMikoClient } from "@miko-ai/sdk"

export const client = createMikoClient({ baseUrl: window.miko.serverUrl })
