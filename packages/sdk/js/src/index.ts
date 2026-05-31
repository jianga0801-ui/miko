export * from "./client.js"
export * from "./server.js"

import { createMikoClient } from "./client.js"
import { createMikoServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export async function createMiko(options?: ServerOptions) {
  const server = await createMikoServer({
    ...options,
  })

  const client = createMikoClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
