import type { TuiPlugin, TuiPluginApi, TuiPluginStatus } from "@miko-ai/plugin/tui"
import type { InternalTuiPlugin } from "../../plugin/internal"
import { useTerminalDimensions } from "@opentui/solid"
import { fileURLToPath } from "url"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { Show, createEffect, createMemo, createSignal } from "solid-js"
import { useBindings } from "../../keymap"
import { createTuiI18n, resolveTuiLanguage, TuiLanguageKVKey, type TuiLanguageConfig } from "../../i18n"

const id = "internal:plugin-manager"

function tr(api: TuiPluginApi, ...args: Parameters<ReturnType<typeof createTuiI18n>["t"]>) {
  return createTuiI18n(
    resolveTuiLanguage(api.kv.get(TuiLanguageKVKey, api.tuiConfig.language) as TuiLanguageConfig | undefined),
  ).t(...args)
}

function state(api: TuiPluginApi, item: TuiPluginStatus) {
  if (!item.enabled) {
    return <span style={{ fg: api.theme.current.textMuted }}>{tr(api, "plugin.state.disabled")}</span>
  }

  return (
    <span style={{ fg: item.active ? api.theme.current.success : api.theme.current.error }}>
      {item.active ? tr(api, "plugin.state.active") : tr(api, "plugin.state.inactive")}
    </span>
  )
}

function source(spec: string) {
  if (!spec.startsWith("file://")) return
  return fileURLToPath(spec)
}

function meta(api: TuiPluginApi, item: TuiPluginStatus, width: number) {
  if (item.source === "internal") {
    if (width >= 120) return tr(api, "plugin.builtin")
    return tr(api, "plugin.builtinShort")
  }
  const next = source(item.spec)
  if (next) return next
  return item.spec
}

function Install(props: { api: TuiPluginApi }) {
  const [global, setGlobal] = createSignal(false)
  const [busy, setBusy] = createSignal(false)

  useBindings(() => ({
    enabled: !busy(),
    bindings: [
      {
        key: "tab",
        desc: tr(props.api, "plugin.install.toggleScope"),
        group: "Plugins",
        cmd: () => setGlobal((value) => !value),
      },
    ],
  }))

  return (
    <props.api.ui.DialogPrompt
      title={tr(props.api, "plugin.install.title")}
      placeholder={tr(props.api, "plugin.install.placeholder")}
      busy={busy()}
      busyText={tr(props.api, "plugin.install.busy")}
      description={() => (
        <box flexDirection="row" gap={1}>
          <text fg={props.api.theme.current.textMuted}>{tr(props.api, "plugin.install.scope")}</text>
          <text fg={busy() ? props.api.theme.current.textMuted : props.api.theme.current.text}>
            {global() ? tr(props.api, "plugin.install.global") : tr(props.api, "plugin.install.local")}
          </text>
          <Show when={!busy()}>
            <text fg={props.api.theme.current.textMuted}>{tr(props.api, "plugin.install.toggleHint")}</text>
          </Show>
        </box>
      )}
      onConfirm={(raw) => {
        if (busy()) return
        const mod = raw.trim()
        if (!mod) {
          props.api.ui.toast({
            variant: "error",
            message: tr(props.api, "plugin.install.nameRequired"),
          })
          return
        }

        setBusy(true)
        void props.api.plugins
          .install(mod, { global: global() })
          .then((out) => {
            if (!out.ok) {
              props.api.ui.toast({
                variant: "error",
                message: out.message,
              })
              if (out.missing) {
                props.api.ui.toast({
                  variant: "info",
                  message: tr(props.api, "plugin.install.checkRegistry"),
                })
              }
              show(props.api)
              return
            }

            props.api.ui.toast({
              variant: "success",
              message: tr(props.api, "plugin.install.installed", {
                mod,
                scope: global() ? tr(props.api, "plugin.install.global") : tr(props.api, "plugin.install.local"),
                dir: out.dir,
              }),
            })
            if (!out.tui) {
              props.api.ui.toast({
                variant: "info",
                message: tr(props.api, "plugin.install.noTui"),
              })
              show(props.api)
              return
            }

            return props.api.plugins.add(mod).then((ok) => {
              if (!ok) {
                props.api.ui.toast({
                  variant: "warning",
                  message: tr(props.api, "plugin.install.loadFailed"),
                })
                show(props.api)
                return
              }

              props.api.ui.toast({
                variant: "success",
                message: tr(props.api, "plugin.install.loaded", { mod }),
              })
              show(props.api)
            })
          })
          .finally(() => {
            setBusy(false)
          })
      }}
      onCancel={() => {
        show(props.api)
      }}
    />
  )
}

function row(api: TuiPluginApi, item: TuiPluginStatus, width: number): DialogSelectOption<string> {
  return {
    title: item.id,
    value: item.id,
    category: item.source === "internal" ? "Internal" : "External",
    description: meta(api, item, width),
    footer: state(api, item),
    disabled: item.id === id,
  }
}

function showInstall(api: TuiPluginApi) {
  api.ui.dialog.replace(() => <Install api={api} />)
}

function View(props: { api: TuiPluginApi }) {
  const size = useTerminalDimensions()
  const [list, setList] = createSignal(props.api.plugins.list())
  const [cur, setCur] = createSignal<string | undefined>()
  const [lock, setLock] = createSignal(false)

  createEffect(() => {
    const width = size().width
    if (width >= 128) {
      props.api.ui.dialog.setSize("xlarge")
      return
    }
    if (width >= 96) {
      props.api.ui.dialog.setSize("large")
      return
    }
    props.api.ui.dialog.setSize("medium")
  })

  const rows = createMemo(() =>
    [...list()]
      .sort((a, b) => {
        const x = a.source === "internal" ? 1 : 0
        const y = b.source === "internal" ? 1 : 0
        if (x !== y) return x - y
        return a.id.localeCompare(b.id)
      })
      .map((item) => row(props.api, item, size().width)),
  )

  const flip = (x: string) => {
    if (lock()) return
    const item = list().find((entry) => entry.id === x)
    if (!item) return
    setLock(true)
    const task = item.active ? props.api.plugins.deactivate(x) : props.api.plugins.activate(x)
    void task
      .then((ok) => {
        if (!ok) {
          props.api.ui.toast({
            variant: "error",
            message: tr(props.api, "plugin.updateFailed", { id: item.id }),
          })
        }
        setList(props.api.plugins.list())
      })
      .finally(() => {
        setLock(false)
      })
  }

  return (
    <DialogSelect
      title="Plugins"
      options={rows()}
      current={cur()}
      onMove={(item) => setCur(item.value)}
      actions={[
        {
          title: "toggle",
          command: "plugins.toggle",
          disabled: lock(),
          onTrigger: (item) => {
            setCur(item.value)
            flip(item.value)
          },
        },
        {
          title: "install",
          command: "dialog.plugins.install",
          disabled: lock(),
          onTrigger: () => {
            showInstall(props.api)
          },
        },
      ]}
      onSelect={(item) => {
        setCur(item.value)
        flip(item.value)
      }}
    />
  )
}

function show(api: TuiPluginApi) {
  api.ui.dialog.replace(() => <View api={api} />)
}

const tui: TuiPlugin = async (api) => {
  api.keymap.registerLayer({
    commands: [
      {
        name: "plugins.list",
        title: "Plugins",
        category: "System",
        namespace: "palette",
        run() {
          show(api)
        },
      },
      {
        name: "plugins.install",
        title: "Install plugin",
        category: "System",
        namespace: "palette",
        run() {
          showInstall(api)
        },
      },
    ],
    bindings: api.tuiConfig.keybinds.gather("plugins.palette", ["plugins.list", "plugins.install"]),
  })
}

const plugin: InternalTuiPlugin = {
  id,
  tui,
}

export default plugin
