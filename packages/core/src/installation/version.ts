import appPackage from "../../../miko/package.json"

declare global {
  const MIKO_VERSION: string
  const MIKO_CHANNEL: string
}

const localVersion = appPackage.version

export const InstallationVersion = typeof MIKO_VERSION === "string" ? MIKO_VERSION : localVersion
export const InstallationChannel = typeof MIKO_CHANNEL === "string" ? MIKO_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
