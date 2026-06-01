# Installing Miko

Miko releases are distributed as self-contained CLI/TUI binaries. End users do
not need Bun, Node.js, or `node_modules`.

## Linux and macOS

```bash
curl -fsSL https://raw.githubusercontent.com/jianga0801-ui/miko/dev/install | bash
miko --version
```

To install a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/jianga0801-ui/miko/dev/install | bash -s -- --version 0.0.1
```

The installer detects Linux glibc/musl, macOS Intel/Apple Silicon, and x64
baseline builds when AVX2 is unavailable.

## Windows

Run PowerShell as a normal user:

```powershell
irm https://raw.githubusercontent.com/jianga0801-ui/miko/dev/install.ps1 | iex
miko --version
```

To install a specific version:

```powershell
$env:VERSION = "0.0.1"; irm https://raw.githubusercontent.com/jianga0801-ui/miko/dev/install.ps1 | iex
```

The Windows installer installs to:

```text
%LOCALAPPDATA%\Programs\Miko\bin
```

It updates the user PATH when needed.

## Manual Install

Download the matching archive from
[GitHub Releases](https://github.com/jianga0801-ui/miko/releases), verify it
against `checksums.txt`, extract the archive, and place `miko` or `miko.exe` on
your PATH.

## Source Development

Only contributors need the source toolchain:

```bash
git clone https://github.com/jianga0801-ui/miko.git
cd miko
bun install
bun run dev
```
