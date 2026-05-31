import { Config, ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (name: string) => Config.boolean(name).pipe(Config.withDefault(false))
const positiveInteger = (name: string) =>
  Config.number(name).pipe(
    Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
    Config.orElse(() => Config.succeed(undefined)),
  )
const experimental = bool("MIKO_EXPERIMENTAL")
const enabledByExperimental = (name: string) =>
  Config.all({ experimental, enabled: Config.boolean(name).pipe(Config.option) }).pipe(
    Config.map((flags) => Option.getOrElse(flags.enabled, () => flags.experimental)),
  )

export class Service extends ConfigService.Service<Service>()("@miko/RuntimeFlags", {
  autoShare: bool("MIKO_AUTO_SHARE"),
  pure: bool("MIKO_PURE"),
  disableDefaultPlugins: bool("MIKO_DISABLE_DEFAULT_PLUGINS"),
  disableEmbeddedWebUi: bool("MIKO_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("MIKO_DISABLE_EXTERNAL_SKILLS"),
  disableLspDownload: bool("MIKO_DISABLE_LSP_DOWNLOAD"),
  disableClaudeCodePrompt: Config.all({
    broad: bool("MIKO_DISABLE_CLAUDE_CODE"),
    direct: bool("MIKO_DISABLE_CLAUDE_CODE_PROMPT"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  disableClaudeCodeSkills: Config.all({
    broad: bool("MIKO_DISABLE_CLAUDE_CODE"),
    direct: bool("MIKO_DISABLE_CLAUDE_CODE_SKILLS"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  enableExa: Config.all({
    experimental,
    enabled: bool("MIKO_ENABLE_EXA"),
    legacy: bool("MIKO_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("MIKO_ENABLE_PARALLEL"),
    legacy: bool("MIKO_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("MIKO_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("MIKO_ENABLE_QUESTION_TOOL"),
  experimentalScout: enabledByExperimental("MIKO_EXPERIMENTAL_SCOUT"),
  experimentalBackgroundSubagents: enabledByExperimental("MIKO_EXPERIMENTAL_BACKGROUND_SUBAGENTS"),
  experimentalLspTy: bool("MIKO_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("MIKO_EXPERIMENTAL_LSP_TOOL"),
  experimentalOxfmt: enabledByExperimental("MIKO_EXPERIMENTAL_OXFMT"),
  experimentalPlanMode: enabledByExperimental("MIKO_EXPERIMENTAL_PLAN_MODE"),
  experimentalEventSystem: enabledByExperimental("MIKO_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalWorkspaces: enabledByExperimental("MIKO_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("MIKO_EXPERIMENTAL_ICON_DISCOVERY"),
  outputTokenMax: positiveInteger("MIKO_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("MIKO_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: bool("MIKO_EXPERIMENTAL_NATIVE_LLM"),
  experimentalWebSockets: bool("MIKO_EXPERIMENTAL_WEBSOCKETS"),
  client: Config.string("MIKO_CLIENT").pipe(Config.withDefault("cli")),
}) {}

export type Info = Context.Service.Shape<typeof Service>

const emptyConfigLayer = Service.defaultLayer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
  Layer.orDie,
)

export const layer = (overrides: Partial<Info> = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const flags = yield* Service
      return Service.of({ ...flags, ...overrides })
    }),
  ).pipe(Layer.provide(emptyConfigLayer))

export const defaultLayer = Service.defaultLayer.pipe(Layer.orDie)

export * as RuntimeFlags from "./runtime-flags"
