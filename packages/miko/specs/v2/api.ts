// @ts-nocheck

import { Miko } from "@miko-ai/core"
import { ReadTool } from "@miko-ai/core/tools"

const miko = Miko.make({})

miko.tool.add(ReadTool)

miko.tool.add({
  name: "bash",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to run.",
      },
    },
    required: ["command"],
  },
  execute(input, ctx) {},
})

miko.auth.add({
  provider: "openai",
  type: "api",
  value: process.env.OPENAI_API_KEY,
})

miko.agent.add({
  name: "build",
  permissions: [],
  model: {
    id: "gpt-5-5",
    provider: "openai",
    variant: "xhigh",
  },
})

const sessionID = await miko.session.create({
  agent: "build",
})

miko.subscribe((event) => {
  console.log(event)
})

await miko.session.prompt({
  sessionID,
  text: "hey what is up",
})

await miko.session.prompt({
  sessionID,
  text: "what is up with this",
  files: [
    {
      mime: "image/png",
      uri: "data:image/png;base64,xxxx",
    },
  ],
})

await miko.session.wait()

console.log(await miko.session.messages(sessionID))
