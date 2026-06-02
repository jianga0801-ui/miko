import { createRequire } from "node:module"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

interface NotifyBackendOptions {
	preferCmux: boolean
	tryCmuxNotify: () => Promise<boolean>
	sendDesktopNotification: () => void | Promise<void>
}

export interface DesktopNotificationOptions {
	title: string
	message: string
	subtitle?: string
	sound?: string
	senderBundleId?: string | null
}

interface DesktopNotificationRouterOptions extends DesktopNotificationOptions {
	platform: NodeJS.Platform | string
	sendNodeNotifierNotification: () => void
	sendMacOSNotification?: (options: DesktopNotificationOptions, runtime?: AlerterRuntime) => Promise<boolean>
	sendWindowsToast?: (
		options: DesktopNotificationOptions & { viaWslInterop: boolean },
		runtime?: WindowsToastRuntime,
	) => Promise<boolean>
	detectWsl?: () => boolean
	warn?: (message: string) => void
}

interface SpawnedProcess {
	exited: Promise<number>
	unref?: () => void
}

interface AlerterRuntime {
	which?: (command: string) => string | null | Promise<string | null>
	spawnProcess?: (argv: string[]) => SpawnedProcess
	warn?: (message: string) => void
}

const ALERTER_INSTALL_HINT =
	"install vjeantet/alerter (brew install vjeantet/tap/alerter) and ensure it is on PATH"

export function buildAlerterArguments(options: DesktopNotificationOptions): string[] {
	const argv = ["alerter", "--message", options.message, "--title", options.title]

	if (options.subtitle) {
		argv.push("--subtitle", options.subtitle)
	}

	if (options.sound) {
		argv.push("--sound", options.sound)
	}

	if (options.senderBundleId) {
		argv.push("--sender", options.senderBundleId)
	}

	return argv
}

export async function sendMacOSAlerterNotification(
	options: DesktopNotificationOptions,
	runtime: AlerterRuntime = {},
): Promise<boolean> {
	const which = runtime.which ?? Bun.which
	const warn = runtime.warn ?? console.warn

	try {
		const alerterPath = await which("alerter")
		if (!alerterPath) {
			warn(`notify: macOS desktop notification skipped; alerter not found on PATH (${ALERTER_INSTALL_HINT}).`)
			return false
		}

		const alerterArguments = buildAlerterArguments(options)
		const spawnProcess = runtime.spawnProcess ?? ((argv: string[]) => Bun.spawn(argv, { stdout: "ignore", stderr: "pipe" }))
		const process = spawnProcess([alerterPath, ...alerterArguments.slice(1)])
		const exitCode = await process.exited

		if (exitCode === 0) return true

		warn(`notify: macOS desktop notification skipped; alerter exited with code ${exitCode}.`)
		return false
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		warn(`notify: macOS desktop notification skipped; alerter failed (${message}).`)
		return false
	}
}

function escapeAppleScriptString(value: string): string {
	return value
		.replace(/[\r\n]+/g, " ")
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
}

export function buildOsascriptNotificationScript(options: DesktopNotificationOptions): string {
	let script = `display notification "${escapeAppleScriptString(options.message)}" with title "${escapeAppleScriptString(
		options.title,
	)}"`
	if (options.subtitle) script += ` subtitle "${escapeAppleScriptString(options.subtitle)}"`
	if (options.sound) script += ` sound name "${escapeAppleScriptString(options.sound)}"`
	return script
}

/**
 * Zero-install macOS fallback: every macOS ships `osascript`, so this always
 * works without alerter / brew. `display notification` even honours the
 * configured sound name (e.g. "Glass").
 */
export async function sendMacOSOsascriptNotification(
	options: DesktopNotificationOptions,
	runtime: AlerterRuntime = {},
): Promise<boolean> {
	const warn = runtime.warn ?? console.warn
	try {
		const script = buildOsascriptNotificationScript(options)
		const spawnProcess =
			runtime.spawnProcess ?? ((argv: string[]) => Bun.spawn(argv, { stdout: "ignore", stderr: "pipe" }))
		const exitCode = await spawnProcess(["osascript", "-e", script]).exited
		if (exitCode === 0) return true
		warn(`notify: macOS osascript notification failed (exit ${exitCode}).`)
		return false
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		warn(`notify: macOS osascript notification failed (${message}).`)
		return false
	}
}

/**
 * Default macOS sender: prefer alerter when it is on PATH (richer — custom sound,
 * sender bundle, click-to-focus), otherwise fall back to the always-available
 * osascript path so notifications work out of the box with no extra install.
 */
export async function sendMacOSNotificationDefault(
	options: DesktopNotificationOptions,
	runtime: AlerterRuntime = {},
): Promise<boolean> {
	const which = runtime.which ?? Bun.which
	let alerterPath: string | null = null
	try {
		alerterPath = await which("alerter")
	} catch {
		alerterPath = null
	}

	if (alerterPath) {
		const delivered = await sendMacOSAlerterNotification(options, runtime)
		if (delivered) return true
	}

	return sendMacOSOsascriptNotification(options, runtime)
}

// ==========================================
// WINDOWS / WSL — SnoreToast native toasts
// ==========================================

const SNORETOAST_BINARY = "snoretoast-x64.exe"

/**
 * True when running under WSL (a Linux process on Windows). WSL processes can
 * launch Windows `.exe` files through the binfmt interop handler, so we route
 * notifications to the Windows toast system instead of the (absent) Linux
 * notification daemon.
 */
export function isWslEnvironment(): boolean {
	if (process.platform !== "linux") return false
	if (process.env.WSL_DISTRO_NAME) return true
	try {
		return os.release().toLowerCase().includes("microsoft")
	} catch {
		return false
	}
}

/**
 * Locate the SnoreToast executable. In a compiled binary it is shipped next to
 * the executable (see script/build.ts, alongside ffmpeg.exe); in dev it lives in
 * the node-notifier vendor directory.
 */
function resolveSnoreToastSource(): string | null {
	const isCompiled = !process.execPath.endsWith("bun") && !process.execPath.endsWith("bun.exe")
	if (isCompiled) {
		const adjacent = path.join(path.dirname(process.execPath), SNORETOAST_BINARY)
		if (fs.existsSync(adjacent)) return adjacent
	}

	try {
		const require = createRequire(import.meta.url)
		const pkg = require.resolve("node-notifier/package.json")
		const vendored = path.join(path.dirname(pkg), "vendor", "snoreToast", SNORETOAST_BINARY)
		if (fs.existsSync(vendored)) return vendored
	} catch {
		// fall through to relative lookup
	}

	const fallback = fileURLToPath(
		new URL(`../../../../node_modules/node-notifier/vendor/snoreToast/${SNORETOAST_BINARY}`, import.meta.url),
	)
	return fs.existsSync(fallback) ? fallback : null
}

let cachedRunnableSnoreToast: string | null | undefined

/**
 * Return a path to a runnable SnoreToast. On WSL the Windows `.exe` must carry an
 * exec bit for binfmt interop; if the resolved copy is not executable we stage an
 * executable copy in the temp dir (never mutating node_modules / the install).
 */
function resolveRunnableSnoreToast(viaWslInterop: boolean): string | null {
	if (cachedRunnableSnoreToast !== undefined) return cachedRunnableSnoreToast

	const source = resolveSnoreToastSource()
	if (!source) {
		cachedRunnableSnoreToast = null
		return null
	}

	if (!viaWslInterop) {
		cachedRunnableSnoreToast = source
		return source
	}

	try {
		fs.accessSync(source, fs.constants.X_OK)
		cachedRunnableSnoreToast = source
		return source
	} catch {
		// not executable under WSL — stage a runnable copy below
	}

	try {
		const staged = path.join(os.tmpdir(), `miko-${SNORETOAST_BINARY}`)
		const srcStat = fs.statSync(source)
		let needsCopy = true
		try {
			needsCopy = fs.statSync(staged).size !== srcStat.size
		} catch {
			needsCopy = true
		}
		if (needsCopy) fs.copyFileSync(source, staged)
		fs.chmodSync(staged, 0o755)
		cachedRunnableSnoreToast = staged
		return staged
	} catch {
		cachedRunnableSnoreToast = null
		return null
	}
}

export interface WindowsToastRuntime {
	resolveBinary?: (viaWslInterop: boolean) => string | null
	spawnProcess?: (argv: string[]) => SpawnedProcess
	warn?: (message: string) => void
}

export async function sendWindowsToastNotification(
	options: DesktopNotificationOptions & { viaWslInterop: boolean },
	runtime: WindowsToastRuntime = {},
): Promise<boolean> {
	const warn = runtime.warn ?? console.warn
	const resolveBinary = runtime.resolveBinary ?? resolveRunnableSnoreToast

	const binary = resolveBinary(options.viaWslInterop)
	if (!binary) {
		warn(
			`notify: Windows toast skipped; ${SNORETOAST_BINARY} not found (expected next to the miko binary or in the node-notifier vendor directory).`,
		)
		return false
	}

	const body = options.subtitle ? `${options.message}\n${options.subtitle}` : options.message
	const argv = [binary, "-t", options.title, "-m", body, "-appID", "Miko"]

	try {
		const spawnProcess =
			runtime.spawnProcess ?? ((args: string[]) => Bun.spawn(args, { stdout: "ignore", stderr: "ignore" }))
		const proc = spawnProcess(argv)

		// SnoreToast blocks until the toast is dismissed or times out. Awaiting its
		// full lifetime would stall the notify pipeline for seconds, so detach and
		// only surface a warning on a hard failure (exit codes 0..5 are normal
		// display/interaction outcomes; higher codes indicate failure to display).
		void proc.exited
			.then((code) => {
				if (typeof code === "number" && code > 5) {
					warn(`notify: Windows toast exited with code ${code}.`)
				}
			})
			.catch(() => {})
		proc.unref?.()

		return true
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		warn(`notify: Windows toast failed to launch (${message}).`)
		return false
	}
}

export async function sendDesktopNotificationByPlatform(
	options: DesktopNotificationRouterOptions,
): Promise<void> {
	const {
		platform,
		sendNodeNotifierNotification,
		sendMacOSNotification,
		sendWindowsToast,
		detectWsl,
		warn,
		...notificationOptions
	} = options

	if (platform === "darwin") {
		await (sendMacOSNotification ?? sendMacOSNotificationDefault)(notificationOptions, { warn })
		return
	}

	const viaWslInterop = (detectWsl ?? isWslEnvironment)()
	if (platform === "win32" || viaWslInterop) {
		const send = sendWindowsToast ?? sendWindowsToastNotification
		const delivered = await send({ ...notificationOptions, viaWslInterop }, { warn })
		if (delivered) return
		// Best-effort fallback to node-notifier (e.g. notify-send on a real Linux
		// desktop, or node-notifier's own SnoreToast resolution on native Windows).
	}

	sendNodeNotifierNotification()
}

export async function sendNotificationWithFallback(options: NotifyBackendOptions): Promise<void> {
	if (!options.preferCmux) {
		await options.sendDesktopNotification()
		return
	}

	try {
		const sentViaCmux = await options.tryCmuxNotify()
		if (sentViaCmux) return
	} catch {
		// Fall through to desktop notification fallback
	}

	await options.sendDesktopNotification()
}
