import { $ } from "bun"
import semver from "semver"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  MIKO_CHANNEL: process.env["MIKO_CHANNEL"],
  MIKO_BUMP: process.env["MIKO_BUMP"],
  MIKO_VERSION: process.env["MIKO_VERSION"],
  MIKO_RELEASE: process.env["MIKO_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.MIKO_CHANNEL) return env.MIKO_CHANNEL
  if (env.MIKO_BUMP) return "latest"
  if (env.MIKO_VERSION && !env.MIKO_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim())
})()
const IS_PREVIEW = CHANNEL !== "latest"

const VERSION = await (async () => {
  if (env.MIKO_VERSION) return env.MIKO_VERSION
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`

  // Get current date in UTC+8 timezone
  const d = new Date()
  const offsetMs = 8 * 60 * 60 * 1000
  const localTime = new Date(d.getTime() + offsetMs)
  const year = localTime.getUTCFullYear()
  const month = localTime.getUTCMonth() + 1
  const date = localTime.getUTCDate()
  const dateStr = `${year}.${month}.${date}`

  try {
    const tagsText = await $`git tag -l`.text()
    const tags = tagsText.split(/\r?\n/).map(t => t.trim()).filter(Boolean)
    const todayTags = tags.filter(tag => tag.startsWith(`v${dateStr}`))
    if (todayTags.length === 0) {
      return dateStr
    }

    let maxSuffix = 1
    for (const tag of todayTags) {
      const escapedDateStr = dateStr.split(".").join("\\\\.")
      const match = tag.match(new RegExp(`^v${escapedDateStr}(?:-(\\d+))?$`))
      if (match) {
        const suffixStr = match[1]
        if (suffixStr) {
          const suffixNum = parseInt(suffixStr, 10)
          if (suffixNum > maxSuffix) {
            maxSuffix = suffixNum
          }
        }
      }
    }
    return `${dateStr}-${maxSuffix + 1}`
  } catch (e) {
    return dateStr
  }
})()

const bot = ["actions-user", "miko", "miko-agent[bot]"]
const teamPath = path.resolve(import.meta.dir, "../../../.github/TEAM_MEMBERS")
const team = [
  ...(await Bun.file(teamPath)
    .text()
    .then((x) => x.split(/\r?\n/).map((x) => x.trim()))
    .then((x) => x.filter((x) => x && !x.startsWith("#")))),
  ...bot,
]

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.MIKO_RELEASE
  },
  get team() {
    return team
  },
}
console.log(`miko script`, JSON.stringify(Script, null, 2))
