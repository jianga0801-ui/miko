import { dlopen } from "bun:ffi"

// tcflush queue selectors differ between Linux and BSD/macOS.
// Linux: TCIFLUSH = 0; BSD/macOS: TCIFLUSH = 1.
const TCIFLUSH = process.platform === "darwin" ? 1 : 0

let tcflush: ((fd: number, queue: number) => number) | null | undefined

function load() {
  if (tcflush !== undefined) return tcflush
  if (process.platform === "win32") return (tcflush = null)
  try {
    const lib = process.platform === "darwin" ? "libSystem.B.dylib" : "libc.so.6"
    const { symbols } = dlopen(lib, {
      tcflush: { args: ["i32", "i32"], returns: "i32" },
    })
    tcflush = symbols.tcflush as (fd: number, queue: number) => number
  } catch {
    tcflush = null
  }
  return tcflush
}

/**
 * Discard any queued terminal input (mouse reports, key presses, etc.).
 *
 * The POSIX counterpart to win32FlushInputBuffer(). When mouse tracking is on,
 * hover/motion events pile up as SGR reports (e.g. `\x1b[<35;92;31M`) in the
 * tty input buffer. On exit we disable mouse mode and restore the terminal to
 * cooked+echo, but the already-buffered bytes survive and get echoed by the
 * shell as garbage. Flushing the input queue after destroy() prevents that.
 */
export function posixFlushInputBuffer() {
  if (process.platform === "win32") return
  if (!process.stdin.isTTY) return
  const fn = load()
  if (!fn) return
  try {
    fn(0, TCIFLUSH)
  } catch {}
}
