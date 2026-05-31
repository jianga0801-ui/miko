import { Config } from "effect"

function env(primary: string, legacy: string): string | undefined {
  return process.env[primary] ?? process.env[legacy]
}

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function truthyEnv(primary: string, legacy: string): boolean {
  const value = env(primary, legacy)?.toLowerCase()
  return value === "true" || value === "1"
}

const MIKO_EXPERIMENTAL = truthyEnv("MIKO_EXPERIMENTAL", "MIKO_EXPERIMENTAL")
const copy = env("MIKO_EXPERIMENTAL_DISABLE_COPY_ON_SELECT", "MIKO_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")

function enabledByExperimental(primary: string, legacy: string) {
  return env(primary, legacy) === undefined ? MIKO_EXPERIMENTAL : truthyEnv(primary, legacy)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  MIKO_AUTO_HEAP_SNAPSHOT: truthyEnv("MIKO_AUTO_HEAP_SNAPSHOT", "MIKO_AUTO_HEAP_SNAPSHOT"),
  MIKO_GIT_BASH_PATH: env("MIKO_GIT_BASH_PATH", "MIKO_GIT_BASH_PATH"),
  MIKO_CONFIG: env("MIKO_CONFIG", "MIKO_CONFIG"),
  MIKO_CONFIG_CONTENT: env("MIKO_CONFIG_CONTENT", "MIKO_CONFIG_CONTENT"),
  MIKO_DISABLE_AUTOUPDATE: truthyEnv("MIKO_DISABLE_AUTOUPDATE", "MIKO_DISABLE_AUTOUPDATE"),
  MIKO_ALWAYS_NOTIFY_UPDATE: truthyEnv("MIKO_ALWAYS_NOTIFY_UPDATE", "MIKO_ALWAYS_NOTIFY_UPDATE"),
  MIKO_DISABLE_PRUNE: truthyEnv("MIKO_DISABLE_PRUNE", "MIKO_DISABLE_PRUNE"),
  MIKO_DISABLE_TERMINAL_TITLE: truthyEnv("MIKO_DISABLE_TERMINAL_TITLE", "MIKO_DISABLE_TERMINAL_TITLE"),
  MIKO_SHOW_TTFD: truthyEnv("MIKO_SHOW_TTFD", "MIKO_SHOW_TTFD"),
  MIKO_DISABLE_AUTOCOMPACT: truthyEnv("MIKO_DISABLE_AUTOCOMPACT", "MIKO_DISABLE_AUTOCOMPACT"),
  MIKO_DISABLE_MODELS_FETCH: truthyEnv("MIKO_DISABLE_MODELS_FETCH", "MIKO_DISABLE_MODELS_FETCH"),
  MIKO_DISABLE_MOUSE: truthyEnv("MIKO_DISABLE_MOUSE", "MIKO_DISABLE_MOUSE"),
  MIKO_FAKE_VCS: env("MIKO_FAKE_VCS", "MIKO_FAKE_VCS"),
  MIKO_SERVER_PASSWORD: env("MIKO_SERVER_PASSWORD", "MIKO_SERVER_PASSWORD"),
  MIKO_SERVER_USERNAME: env("MIKO_SERVER_USERNAME", "MIKO_SERVER_USERNAME"),

  // Experimental
  MIKO_EXPERIMENTAL_FILEWATCHER: Config.boolean("MIKO_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.orElse(() => Config.boolean("MIKO_EXPERIMENTAL_FILEWATCHER")),
    Config.withDefault(false),
  ),
  MIKO_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("MIKO_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.orElse(() => Config.boolean("MIKO_EXPERIMENTAL_DISABLE_FILEWATCHER")),
    Config.withDefault(false),
  ),
  MIKO_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthyEnv("MIKO_EXPERIMENTAL_DISABLE_COPY_ON_SELECT", "MIKO_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  MIKO_MODELS_URL: env("MIKO_MODELS_URL", "MIKO_MODELS_URL"),
  MIKO_MODELS_PATH: env("MIKO_MODELS_PATH", "MIKO_MODELS_PATH"),
  MIKO_DB: env("MIKO_DB", "MIKO_DB"),

  MIKO_WORKSPACE_ID: env("MIKO_WORKSPACE_ID", "MIKO_WORKSPACE_ID"),
  MIKO_EXPERIMENTAL_WORKSPACES: enabledByExperimental("MIKO_EXPERIMENTAL_WORKSPACES", "MIKO_EXPERIMENTAL_WORKSPACES"),
  MIKO_EXPERIMENTAL_SESSION_SWITCHER: enabledByExperimental("MIKO_EXPERIMENTAL_SESSION_SWITCHER", "MIKO_EXPERIMENTAL_SESSION_SWITCHER"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get MIKO_DISABLE_PROJECT_CONFIG() {
    return truthyEnv("MIKO_DISABLE_PROJECT_CONFIG", "MIKO_DISABLE_PROJECT_CONFIG")
  },
  get MIKO_TUI_CONFIG() {
    return env("MIKO_TUI_CONFIG", "MIKO_TUI_CONFIG")
  },
  get MIKO_CONFIG_DIR() {
    return env("MIKO_CONFIG_DIR", "MIKO_CONFIG_DIR")
  },
  get MIKO_PURE() {
    return truthyEnv("MIKO_PURE", "MIKO_PURE")
  },
  get MIKO_PERMISSION() {
    return env("MIKO_PERMISSION", "MIKO_PERMISSION")
  },
  get MIKO_PLUGIN_META_FILE() {
    return env("MIKO_PLUGIN_META_FILE", "MIKO_PLUGIN_META_FILE")
  },
  get MIKO_CLIENT() {
    return env("MIKO_CLIENT", "MIKO_CLIENT") ?? "cli"
  },
}
