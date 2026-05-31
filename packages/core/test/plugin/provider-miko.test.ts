import { describe, expect } from "bun:test"
import { DateTime, Effect, Layer, Option } from "effect"
import { Catalog } from "@miko-ai/core/catalog"
import { EventV2 } from "@miko-ai/core/event"
import { Location } from "@miko-ai/core/location"
import { ModelV2 } from "@miko-ai/core/model"
import { PluginV2 } from "@miko-ai/core/plugin"
import { MikoPlugin } from "@miko-ai/core/plugin/provider/miko"
import { ProviderV2 } from "@miko-ai/core/provider"
import { AbsolutePath } from "@miko-ai/core/schema"
import { location } from "../fixture/location"
import { it, model, provider, withEnv } from "./provider-helper"

const cost = (input: number, output = 0) => [{ input, output, cache: { read: 0, write: 0 } }]
const locationLayer = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make("test") })),
)

describe("MikoPlugin", () => {
  it.effect("uses a public key and disables paid models without credentials", () =>
    withEnv({ MIKO_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(MikoPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("miko")
          catalog.provider.update(item.id, () => {})
          const paid = model("miko", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.miko)).options.aisdk.provider.apiKey).toBe("public")
        expect((yield* catalog.model.get(ProviderV2.ID.miko, ModelV2.ID.make("paid"))).enabled).toBe(false)
      }),
    ),
  )

  it.effect("keeps free models without credentials", () =>
    withEnv({ MIKO_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(MikoPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("miko")
          catalog.provider.update(item.id, () => {})
          const free = model("miko", "free", { cost: cost(0) })
          catalog.model.update(item.id, free.id, (draft) => {
            draft.cost = [...free.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.miko)).options.aisdk.provider.apiKey).toBe("public")
        expect((yield* catalog.model.get(ProviderV2.ID.miko, ModelV2.ID.make("free"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("treats output-only cost as free without credentials", () =>
    withEnv({ MIKO_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(MikoPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("miko")
          catalog.provider.update(item.id, () => {})
          const outputOnly = model("miko", "output-only", { cost: cost(0, 1) })
          catalog.model.update(item.id, outputOnly.id, (draft) => {
            draft.cost = [...outputOnly.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.miko)).options.aisdk.provider.apiKey).toBe("public")
        expect((yield* catalog.model.get(ProviderV2.ID.miko, ModelV2.ID.make("output-only"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses MIKO_API_KEY as credentials", () =>
    withEnv({ MIKO_API_KEY: "secret" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(MikoPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("miko")
          catalog.provider.update(item.id, () => {})
          const paid = model("miko", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.miko)).options.aisdk.provider.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.miko, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses configured provider env vars as credentials", () =>
    withEnv({ MIKO_API_KEY: undefined, CUSTOM_MIKO_API_KEY: "secret" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(MikoPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("miko", { env: ["CUSTOM_MIKO_API_KEY"] })
          catalog.provider.update(item.id, (draft) => {
            draft.env = [...item.env]
          })
          const paid = model("miko", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.miko)).options.aisdk.provider.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.miko, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses configured apiKey as credentials", () =>
    withEnv({ MIKO_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(MikoPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("miko", {
            options: {
              headers: {},
              body: {},
              aisdk: {
                provider: { apiKey: "configured" },
                request: {},
              },
            },
          })
          catalog.provider.update(item.id, (draft) => {
            draft.options = item.options
          })
          const paid = model("miko", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.miko)).options.aisdk.provider.apiKey).toBe("configured")
        expect((yield* catalog.model.get(ProviderV2.ID.miko, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses auth-enabled providers as credentials", () =>
    withEnv({ MIKO_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(MikoPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("miko", { enabled: { via: "account", service: "miko" } })
          catalog.provider.update(item.id, (draft) => {
            draft.enabled = item.enabled
          })
          const paid = model("miko", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.miko)).options.aisdk.provider.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.miko, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("ignores non-miko providers and models", () =>
    withEnv({ MIKO_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(MikoPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("openai")
          catalog.provider.update(item.id, () => {})
          const paid = model("openai", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.openai)).options.aisdk.provider.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.openai, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("prefers gpt-5-nano as the miko small model", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const providerID = ProviderV2.ID.miko

      const transform = yield* catalog.transform()
      yield* transform((catalog) => {
        catalog.provider.update(providerID, () => {})
        catalog.model.update(providerID, ModelV2.ID.make("cheap-mini"), (model) => {
          model.capabilities.input = ["text"]
          model.capabilities.output = ["text"]
          model.cost = [...cost(1, 1)]
          model.time.released = DateTime.makeUnsafe(Date.now())
        })
        catalog.model.update(providerID, ModelV2.ID.make("gpt-5-nano"), (model) => {
          model.capabilities.input = ["text"]
          model.capabilities.output = ["text"]
          model.cost = [...cost(10, 10)]
          model.time.released = DateTime.makeUnsafe(Date.now())
        })
      })

      const selected = yield* catalog.model.small(providerID)

      expect(Option.getOrUndefined(selected)?.id).toBe(ModelV2.ID.make("gpt-5-nano"))
    }).pipe(
      Effect.provide(Catalog.locationLayer.pipe(Layer.provide(EventV2.defaultLayer), Layer.provide(locationLayer))),
    ),
  )
})
