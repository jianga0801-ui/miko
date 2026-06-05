import type { AssistantMessage } from "@miko-ai/sdk/v2"
import type { TuiPlugin, TuiPluginApi } from "@miko-ai/plugin/tui"
import type { InternalTuiPlugin } from "../../plugin/internal"
import { createMemo } from "solid-js"
import { createTuiI18n, resolveTuiLanguage, TuiLanguageKVKey, type TuiLanguageConfig } from "../../i18n"

const id = "internal:sidebar-context"

function tr(api: TuiPluginApi, ...args: Parameters<ReturnType<typeof createTuiI18n>["t"]>) {
  return createTuiI18n(
    resolveTuiLanguage(api.kv.get(TuiLanguageKVKey, api.tuiConfig.language) as TuiLanguageConfig | undefined),
  ).t(...args)
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const msg = createMemo(() => props.api.state.session.messages(props.session_id))

  const state = createMemo(() => {
    const messages = msg()
    const last = messages.findLast(
      (item): item is AssistantMessage => item.role === "assistant" && item.tokens.output > 0,
    )
    if (!last) {
      return {
        tokens: 0,
        percent: null,
      }
    }

    const tokens =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = props.api.state.provider.find((item) => item.id === last.providerID)?.models[last.modelID]

    return {
      tokens,
      percent: model?.limit.context ? Math.round((tokens / model.limit.context) * 100) : null,
    }
  })

  return (
    <box>
      <text fg={theme().text}>
        <b>{tr(props.api, "sidebar.context.title")}</b>
      </text>
      <text fg={theme().textMuted}>{tr(props.api, "sidebar.context.tokens", { count: state().tokens.toLocaleString() })}</text>
      <text fg={theme().textMuted}>{tr(props.api, "sidebar.context.used", { percent: state().percent ?? 0 })}</text>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: InternalTuiPlugin = {
  id,
  tui,
}

export default plugin
