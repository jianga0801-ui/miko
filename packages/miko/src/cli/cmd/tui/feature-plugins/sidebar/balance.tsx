import type { AssistantMessage } from "@miko-ai/sdk/v2"
import type { TuiPlugin, TuiPluginApi } from "@miko-ai/plugin/tui"
import type { InternalTuiPlugin } from "../../plugin/internal"
import { computeMimoCredits, isTokenPlanProviderID, parseMimoCreditAmount } from "@/provider/mimo-credits"
import { createMemo, Show } from "solid-js"
import { createTuiI18n, resolveTuiLanguage, TuiLanguageKVKey, type TuiLanguageConfig } from "../../i18n"

const id = "internal:sidebar-balance"

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

type BalanceState =
  | {
      type: "token-plan"
      used: number
      current?: number
    }
  | {
      type: "account"
      spent: number
    }

export function formatCredits(value: number): string {
  return creditFmt.format(value)
}

export function creditPercentage(current: number, used: number): string {
  if (current <= 0) return "0%"
  return `${Math.max(0, (current - used) / current * 100).toFixed(2)}%`
}

export function tokenPlanRemaining(input: { current?: number; used: number }): number | undefined {
  if (input.current === undefined) return
  return Math.max(0, input.current - input.used)
}

function lastAssistant(messages: readonly unknown[]): AssistantMessage | undefined {
  return messages.findLast(
    (item): item is AssistantMessage =>
      typeof item === "object" &&
      item !== null &&
      "role" in item &&
      item.role === "assistant" &&
      "providerID" in item &&
      "modelID" in item &&
      "tokens" in item,
  )
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

function state(input: { messages: readonly unknown[]; spent: number; remainingCredits?: number }): BalanceState | undefined {
  const last = lastAssistant(input.messages)
  if (!last) return

  if (isTokenPlanProviderID(last.providerID)) {
    const used = computeTokenPlanSessionCredits(input.messages)
    return {
      type: "token-plan",
      used,
      current: input.remainingCredits,
    }
  }

  return { type: "account", spent: input.spent }
}

function Rows(props: { api: TuiPluginApi; item: BalanceState; muted: TuiPluginApi["theme"]["current"]["textMuted"] }) {
  if (props.item.type === "token-plan") {
    return (
      <>
        <text fg={props.muted}>{tr(props.api, "sidebar.balance.creditsUsed", { amount: formatCredits(props.item.used) })}</text>
        <text fg={props.muted}>
          {props.item.current === undefined
            ? tr(props.api, "sidebar.balance.remainingUnavailable")
            : tr(props.api, "sidebar.balance.creditRemainingPercent", { amount: creditPercentage(props.item.current, props.item.used) })}
        </text>
      </>
    )
  }

  return (
    <text fg={props.muted}>{tr(props.api, "sidebar.balance.accountSpent", { amount: money.format(props.item.spent) })}</text>
  )
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const messages = createMemo(() => props.api.state.session.messages(props.session_id))
  const session = createMemo(() => props.api.state.session.get(props.session_id))
  const remainingCredits = createMemo(() => parseMimoCreditAmount(process.env.MIKO_MIMO_TOKEN_PLAN_REMAINING_CREDITS))
  const current = createMemo(() =>
    state({
      messages: messages(),
      spent: session()?.cost ?? 0,
      remainingCredits: remainingCredits(),
    }),
  )

  return (
    <Show when={current()}>
      {(item) => (
        <box>
          <text fg={theme().text}>
            <b>{tr(props.api, "sidebar.balance.title")}</b>
          </text>
          <Rows api={props.api} item={item()} muted={theme().textMuted} />
        </box>
      )}
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 110,
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
