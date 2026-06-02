import { describe, expect, test } from "bun:test"
import {
	buildOsascriptNotificationScript,
	sendDesktopNotificationByPlatform,
	sendMacOSNotificationDefault,
	sendWindowsToastNotification,
} from "@/plugin/kdco/notify/backend"

describe("sendDesktopNotificationByPlatform routing", () => {
	const base = {
		title: "Title",
		message: "Body",
		sendNodeNotifierNotification: () => {},
	}

	test("darwin uses the macOS notifier and never node-notifier", async () => {
		let nodeNotifierCalls = 0
		let macCalls = 0
		await sendDesktopNotificationByPlatform({
			...base,
			platform: "darwin",
			sendNodeNotifierNotification: () => {
				nodeNotifierCalls++
			},
			sendMacOSNotification: async () => {
				macCalls++
				return true
			},
		})
		expect(macCalls).toBe(1)
		expect(nodeNotifierCalls).toBe(0)
	})

	test("win32 routes to the Windows toast sender (no WSL interop)", async () => {
		let viaWslInterop: boolean | undefined
		let nodeNotifierCalls = 0
		await sendDesktopNotificationByPlatform({
			...base,
			platform: "win32",
			detectWsl: () => false,
			sendNodeNotifierNotification: () => {
				nodeNotifierCalls++
			},
			sendWindowsToast: async (options) => {
				viaWslInterop = options.viaWslInterop
				return true
			},
		})
		expect(viaWslInterop).toBe(false)
		expect(nodeNotifierCalls).toBe(0)
	})

	test("linux under WSL routes to the Windows toast sender with interop", async () => {
		let viaWslInterop: boolean | undefined
		await sendDesktopNotificationByPlatform({
			...base,
			platform: "linux",
			detectWsl: () => true,
			sendWindowsToast: async (options) => {
				viaWslInterop = options.viaWslInterop
				return true
			},
		})
		expect(viaWslInterop).toBe(true)
	})

	test("plain Linux desktop falls back to node-notifier", async () => {
		let nodeNotifierCalls = 0
		await sendDesktopNotificationByPlatform({
			...base,
			platform: "linux",
			detectWsl: () => false,
			sendNodeNotifierNotification: () => {
				nodeNotifierCalls++
			},
		})
		expect(nodeNotifierCalls).toBe(1)
	})

	test("Windows toast failure falls back to node-notifier", async () => {
		let nodeNotifierCalls = 0
		await sendDesktopNotificationByPlatform({
			...base,
			platform: "win32",
			detectWsl: () => false,
			sendNodeNotifierNotification: () => {
				nodeNotifierCalls++
			},
			sendWindowsToast: async () => false,
		})
		expect(nodeNotifierCalls).toBe(1)
	})
})

describe("sendWindowsToastNotification", () => {
	test("builds SnoreToast argv with title/body/appID", async () => {
		let argv: string[] | undefined
		const ok = await sendWindowsToastNotification(
			{ title: "Ready", message: "Task done", subtitle: "miko", viaWslInterop: false },
			{
				resolveBinary: () => "/path/to/snoretoast-x64.exe",
				spawnProcess: (args) => {
					argv = args
					return { exited: Promise.resolve(0), unref: () => {} }
				},
			},
		)
		expect(ok).toBe(true)
		expect(argv?.[0]).toBe("/path/to/snoretoast-x64.exe")
		expect(argv).toContain("-t")
		expect(argv).toContain("Ready")
		expect(argv).toContain("-m")
		// subtitle is folded into the message body
		expect(argv?.find((a) => a.includes("Task done") && a.includes("miko"))).toBeDefined()
		expect(argv).toContain("-appID")
	})

	test("returns false and warns when the binary cannot be resolved", async () => {
		let warned = ""
		const ok = await sendWindowsToastNotification(
			{ title: "t", message: "m", viaWslInterop: true },
			{ resolveBinary: () => null, warn: (msg) => (warned = msg) },
		)
		expect(ok).toBe(false)
		expect(warned).toContain("snoretoast")
	})

	test("returns false when spawning throws", async () => {
		const ok = await sendWindowsToastNotification(
			{ title: "t", message: "m", viaWslInterop: false },
			{
				resolveBinary: () => "/path/to/snoretoast-x64.exe",
				spawnProcess: () => {
					throw new Error("ENOENT")
				},
				warn: () => {},
			},
		)
		expect(ok).toBe(false)
	})
})

describe("macOS notification fallback", () => {
	test("buildOsascriptNotificationScript escapes quotes and includes subtitle + sound", () => {
		const script = buildOsascriptNotificationScript({
			title: 'He said "hi"',
			message: "line1\nline2",
			subtitle: "sub",
			sound: "Glass",
		})
		expect(script).toContain('display notification "line1 line2"')
		expect(script).toContain('with title "He said \\"hi\\""')
		expect(script).toContain('subtitle "sub"')
		expect(script).toContain('sound name "Glass"')
	})

	test("prefers alerter when it is on PATH", async () => {
		const argvs: string[][] = []
		const ok = await sendMacOSNotificationDefault(
			{ title: "t", message: "m" },
			{
				which: async () => "/usr/local/bin/alerter",
				spawnProcess: (argv) => {
					argvs.push(argv)
					return { exited: Promise.resolve(0) }
				},
			},
		)
		expect(ok).toBe(true)
		expect(argvs[0]?.[0]).toBe("/usr/local/bin/alerter")
	})

	test("falls back to osascript when alerter is missing", async () => {
		const argvs: string[][] = []
		const ok = await sendMacOSNotificationDefault(
			{ title: "t", message: "m" },
			{
				which: async () => null,
				spawnProcess: (argv) => {
					argvs.push(argv)
					return { exited: Promise.resolve(0) }
				},
			},
		)
		expect(ok).toBe(true)
		expect(argvs[0]?.[0]).toBe("osascript")
		expect(argvs[0]).toContain("-e")
	})
})
