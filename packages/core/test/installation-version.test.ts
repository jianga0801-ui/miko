import { describe, expect, test } from "bun:test"
import appPackage from "../../miko/package.json"
import { InstallationVersion } from "@miko-ai/core/installation/version"

describe("installation version", () => {
  test("uses the app package version for local source runs", () => {
    expect(InstallationVersion).toBe(appPackage.version)
  })
})
