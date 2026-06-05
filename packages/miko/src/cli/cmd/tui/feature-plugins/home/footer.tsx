import type { TuiPlugin, TuiPluginApi } from "@miko-ai/plugin/tui"
import type { InternalTuiPlugin } from "../../plugin/internal"
import { createMemo, Match, Show, Switch } from "solid-js"
import { Global } from "@miko-ai/core/global"
import {
  createTuiI18n,
  resolveTuiLanguage,
  TuiLanguageKVKey,
  type TuiLanguageConfig,
} from "../../i18n"

const id = "internal:home-footer"

function Directory(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const dir = createMemo(() => {
    const dir = props.api.state.path.directory || process.cwd()
    const out = dir.replace(Global.Path.home, "~")
    const branch = props.api.state.vcs?.branch
    if (branch) return out + ":" + branch
    return out
  })

  return <text fg={theme().textMuted}>{dir()}</text>
}

function Mcp(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const list = createMemo(() => props.api.state.mcp())
  const has = createMemo(() => list().length > 0)
  const err = createMemo(() => list().some((item) => item.status === "failed"))
  const count = createMemo(() => list().filter((item) => item.status === "connected").length)

  return (
    <Show when={has()}>
      <box gap={1} flexDirection="row" flexShrink={0}>
        <text fg={theme().text}>
          <Switch>
            <Match when={err()}>
              <span style={{ fg: theme().error }}>⊙ </span>
            </Match>
            <Match when={true}>
              <span style={{ fg: count() > 0 ? theme().success : theme().textMuted }}>⊙ </span>
            </Match>
          </Switch>
          {count()} MCP
        </text>
        <text fg={theme().textMuted}>/status</text>
      </box>
    </Show>
  )
}

function Version(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current

  return (
    <box flexShrink={0}>
      <text fg={theme().textMuted}>{props.api.app.version}</text>
    </box>
  )
}

function language(api: TuiPluginApi) {
  return resolveTuiLanguage(api.kv.get(TuiLanguageKVKey, api.tuiConfig.language) as TuiLanguageConfig | undefined)
}

function ShortcutHint(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const trigger = createMemo(() =>
    props.api.keys.formatSequence(
      props.api.keymap
        .getCommandBindings({ visibility: "registered", commands: ["which-key.toggle"] })
        .get("which-key.toggle")?.[0]?.sequence,
    ),
  )
  const label = createMemo(() => createTuiI18n(language(props.api)).t("whichKey.homeHint"))

  return (
    <box flexDirection="row" gap={1} flexShrink={0}>
      <text fg={theme().textMuted}>{label()}</text>
      <text>
        <span style={{ fg: theme().primary, bold: true }}>{trigger() || "f1"}</span>
      </text>
    </box>
  )
}

function View(props: { api: TuiPluginApi }) {
  return (
    <box
      width="100%"
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
      flexDirection="row"
      flexShrink={0}
      gap={2}
    >
      <Directory api={props.api} />
      <Mcp api={props.api} />
      <box flexGrow={1} />
      <ShortcutHint api={props.api} />
      <Version api={props.api} />
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      home_footer() {
        return <View api={api} />
      },
    },
  })
}

const plugin: InternalTuiPlugin = {
  id,
  tui,
}

export default plugin
