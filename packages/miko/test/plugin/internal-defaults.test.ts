import { afterEach, describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { CrossSpawnSpawner } from "@miko-ai/core/cross-spawn-spawner"
import { AppFileSystem } from "@miko-ai/core/filesystem"
import { EventV2Bridge } from "../../src/event-v2-bridge"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { Plugin } from "../../src/plugin/index"
import { disposeAllInstances, provideInstance, testInstanceStoreLayer, tmpdirScoped } from "../fixture/fixture"
import { TestConfig } from "../fixture/config"
import { testEffect } from "../lib/effect"

const it = testEffect(
  Layer.mergeAll(CrossSpawnSpawner.defaultLayer, AppFileSystem.defaultLayer, testInstanceStoreLayer),
)

const removedProviderAuths = [
  "openai",
  "github-copilot",
  "gitlab",
  "poe",
  "cloudflare-workers-ai",
  "cloudflare-ai-gateway",
  "azure",
  "digitalocean",
  "xai",
]

afterEach(async () => {
  await disposeAllInstances()
})

function providerAuths() {
  return Effect.gen(function* () {
    const dir = yield* tmpdirScoped()
    return yield* Effect.gen(function* () {
      const plugin = yield* Plugin.Service
      const hooks = yield* plugin.list()
      return hooks.flatMap((hook) => (hook.auth?.provider ? [hook.auth.provider] : []))
    }).pipe(
      Effect.provide(
        Plugin.layer.pipe(
          Layer.provide(EventV2Bridge.defaultLayer),
          Layer.provide(RuntimeFlags.layer()),
          Layer.provide(
            TestConfig.layer({
              get: () => Effect.succeed({ plugin: [], plugin_origins: [] }),
              directories: () => Effect.succeed([dir]),
            }),
          ),
        ),
      ),
      provideInstance(dir),
    )
  })
}

describe("plugin.internalDefaults", () => {
  it.live("does not load unused provider auth plugins by default", () =>
    Effect.gen(function* () {
      const providers = yield* providerAuths()
      for (const provider of removedProviderAuths) {
        expect(providers).not.toContain(provider)
      }
    }),
  )
})
