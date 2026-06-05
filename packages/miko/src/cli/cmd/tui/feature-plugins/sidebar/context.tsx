import type { AssistantMessage } from "@miko-ai/sdk/v2"
import type { TuiPlugin, TuiPluginApi } from "@miko-ai/plugin/tui"
import type { InternalTuiPlugin } from "../../plugin/internal"
import { createMemo, Show } from "solid-js"
import { createTuiI18n, resolveTuiLanguage, TuiLanguageKVKey, type TuiLanguageConfig } from "../../i18n"
import { computeMimoCredits, isTokenPlanProviderID } from "@/provider/mimo-credits"

const id = "internal:sidebar-context"

function tr(api: TuiPluginApi, ...args: Parameters<ReturnType<typeof createTuiI18n>["t"]>) {
  return createTuiI18n(
    resolveTuiLanguage(api.kv.get(TuiLanguageKVKey, api.tuiConfig.language) as TuiLanguageConfig | undefined),
  ).t(...args)
}

const creditFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
})

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function formatCredits(value: number): string {
  return creditFmt.format(value)
}

export function computeTokenPlanSessionCredits(messages: readonly unknown[]): number {
  let credits = 0
  for (const item of messages) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("role" in item) ||
      item.role !== "assistant" ||
      !("providerID" in item) ||
      typeof item.providerID !== "string" ||
      !isTokenPlanProviderID(item.providerID) ||
      !("modelID" in item) ||
      typeof item.modelID !== "string" ||
      !("tokens" in item) ||
      !("time" in item)
    ) {
      continue
    }

    const message = item as AssistantMessage
    credits += computeMimoCredits({
      modelID: message.modelID,
      tokens: message.tokens,
      atMs: message.time.created,
    })
  }
  return credits
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const msg = createMemo(() => props.api.state.session.messages(props.session_id))
  const session = createMemo(() => props.api.state.session.get(props.session_id))

  const state = createMemo(() => {
    const messages = msg()
    const last = messages.findLast(
      (item): item is AssistantMessage => item.role === "assistant" && item.tokens.output > 0,
    )
    if (!last) {
      return {
        tokens: 0,
        percent: null,
        balance: null,
        cacheHit: 0,
      }
    }

    const tokens =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = props.api.state.provider.find((item) => item.id === last.providerID)?.models[last.modelID]

    let balance: string | null = null
    if (isTokenPlanProviderID(last.providerID)) {
      const used = computeTokenPlanSessionCredits(messages)
      balance = tr(props.api, "sidebar.balance.creditsUsed", { amount: formatCredits(used) })
    } else {
      const spent = session()?.cost ?? 0
      balance = tr(props.api, "sidebar.balance.accountSpent", { amount: money.format(spent) })
    }

    return {
      tokens,
      percent: model?.limit.context ? Math.round((tokens / model.limit.context) * 100) : null,
      balance,
      cacheHit: last.tokens.cache.read ?? 0,
    }
  })

  return (
    <box>
      <text fg={theme().text}>
        <b>{tr(props.api, "sidebar.context.title")}</b>
      </text>
      <text fg={theme().textMuted}>
        {`  ${tr(props.api, "sidebar.context.usage", {
          count: state().tokens.toLocaleString(),
          percent: state().percent ?? 0,
        })}`}
      </text>
      <Show when={state().cacheHit > 0}>
        <text fg={theme().textMuted}>
          {`  ${tr(props.api, "sidebar.context.cacheHit", {
            count: state().cacheHit.toLocaleString(),
          })}`}
        </text>
      </Show>
      <Show when={state().balance}>
        <text fg={theme().textMuted}>
          {`  ${tr(props.api, "sidebar.context.cost", {
            amount: state().balance!,
          })}`}
        </text>
      </Show>
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
