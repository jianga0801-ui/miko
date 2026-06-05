import { createMemo } from "solid-js"
import { useLocal } from "@tui/context/local"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useTuiI18n } from "../context/i18n"

function formatVariantName(variant: string, language: string) {
  if (variant === "default") return language === "zh-CN" ? "默认" : "Default"
  if (language === "zh-CN") {
    if (variant === "enabled") return "开启"
    if (variant === "disabled") return "关闭"
    if (variant === "low") return "低"
    if (variant === "medium") return "中"
    if (variant === "high") return "高"
  }
  if (variant === "enabled") return "On"
  if (variant === "disabled") return "Off"
  return variant
    .split(/[_-]/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ")
}

export function DialogVariant() {
  const local = useLocal()
  const dialog = useDialog()
  const i18n = useTuiI18n()

  const options = createMemo(() => {
    return [
      ...local.model.variant.list().map((variant) => ({
        value: variant,
        title: formatVariantName(variant, i18n.language),
        onSelect: () => {
          dialog.clear()
          local.model.variant.set(variant === "default" ? undefined : variant)
        },
      })),
    ]
  })

  return (
    <DialogSelect<string>
      options={options()}
      title={i18n.t("model.variantSelect")}
      current={local.model.variant.effective()}
      flat={true}
    />
  )
}
