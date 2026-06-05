import type { TuiPlugin, TuiPluginApi } from "@miko-ai/plugin/tui"
import type { InternalTuiPlugin } from "../../plugin/internal"
import { createMemo, For, Show, createSignal } from "solid-js"
import { createTuiI18n, resolveTuiLanguage, TuiLanguageKVKey, type TuiLanguageConfig } from "../../i18n"

const id = "internal:sidebar-lsp"

function tr(api: TuiPluginApi, ...args: Parameters<ReturnType<typeof createTuiI18n>["t"]>) {
  return createTuiI18n(
    resolveTuiLanguage(api.kv.get(TuiLanguageKVKey, api.tuiConfig.language) as TuiLanguageConfig | undefined),
  ).t(...args)
}

export function View(props: { api: TuiPluginApi }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  const list = createMemo(() => props.api.state.lsp())
  const off = createMemo(() => props.api.state.config.lsp === false)

  return (
    <box>
      <box flexDirection="row" gap={1} onMouseDown={() => list().length > 2 && setOpen((x) => !x)}>
        <Show when={list().length > 2}>
          <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
        </Show>
        <text fg={theme().text}>
          <b>LSP</b>
        </text>
      </box>
      <Show when={list().length <= 2 || open()}>
        <Show when={list().length === 0}>
          <text fg={theme().textMuted}>
            {off() ? tr(props.api, "sidebar.lsp.disabled") : tr(props.api, "sidebar.lsp.pending")}
          </text>
        </Show>
        <For each={list()}>
          {(item) => (
            <box flexDirection="row" gap={1}>
              <text
                flexShrink={0}
                style={{
                  fg: item.status === "connected" ? theme().success : theme().error,
                }}
              >
                •
              </text>
              <text fg={theme().textMuted}>
                {item.id} {item.root}
              </text>
            </box>
          )}
        </For>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 300,
    slots: {
      sidebar_content() {
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
