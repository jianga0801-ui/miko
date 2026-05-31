import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { Catalog } from "@miko-ai/core/catalog"
import { LocationServiceMap } from "@miko-ai/core/location-layer"
import { PluginBoot } from "@miko-ai/core/plugin/boot"
import { ProviderV2 } from "@miko-ai/core/provider"
import { AbsolutePath } from "@miko-ai/core/schema"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const it = testEffect(LocationServiceMap.layer)

describe("LocationServiceMap", () => {
  it.live("isolates location state while sharing location policy with catalog", () =>
    Effect.acquireRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      (dirs) => Effect.promise(() => Promise.all(dirs.map((dir) => dir[Symbol.asyncDispose]())).then(() => undefined)),
    ).pipe(
      Effect.flatMap(([blocked, allowed]) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            fs.writeFile(
              path.join(blocked.path, "miko.json"),
              JSON.stringify({
                experimental: { policies: [{ effect: "deny", action: "provider.use", resource: "test" }] },
              }),
            ),
          )

          const update = (directory: string) =>
            Effect.gen(function* () {
              yield* PluginBoot.Service.use((boot) => boot.wait())
              const catalog = yield* Catalog.Service
              const transform = yield* catalog.transform()
              yield* transform((editor) => editor.provider.update(ProviderV2.ID.make("test"), () => {}))
              return yield* catalog.provider.all()
            }).pipe(Effect.scoped, Effect.provide(LocationServiceMap.get({ directory: AbsolutePath.make(directory) })))

          expect((yield* update(blocked.path)).some((provider) => provider.id === ProviderV2.ID.make("test"))).toBe(
            false,
          )
          expect((yield* update(allowed.path)).some((provider) => provider.id === ProviderV2.ID.make("test"))).toBe(
            true,
          )
        }),
      ),
    ),
  )
})
