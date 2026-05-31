declare global {
  const MIKO_VERSION: string
  const MIKO_CHANNEL: string
}

export const InstallationVersion = typeof MIKO_VERSION === "string" ? MIKO_VERSION : "0.0.1 dev"
export const InstallationChannel = typeof MIKO_CHANNEL === "string" ? MIKO_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
