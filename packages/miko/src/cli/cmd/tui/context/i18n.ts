import {
  createTuiI18n,
  resolveTuiLanguage,
  translateCommandText,
  TuiLanguageKVKey,
  type TuiLanguageConfig,
} from "../i18n"
import { useKV } from "./kv"
import { useTuiConfig } from "./tui-config"

export function useTuiI18n() {
  const config = useTuiConfig()
  const kv = useKV()

  function currentLanguage() {
    return resolveTuiLanguage(kv.get(TuiLanguageKVKey, config.language) as TuiLanguageConfig | undefined)
  }

  return {
    get language() {
      return currentLanguage()
    },
    t(...args: Parameters<ReturnType<typeof createTuiI18n>["t"]>) {
      return createTuiI18n(currentLanguage()).t(...args)
    },
    command(text: string | undefined) {
      return translateCommandText(text, currentLanguage())
    },
  }
}
