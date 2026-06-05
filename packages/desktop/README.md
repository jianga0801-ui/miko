# @miko-ai/desktop

miko 的桌面应用（Electron + SolidJS）。当前为基础骨架：拉起本地 miko server，连上后可新建会话、发 prompt、看回复。

## 开发

    bun install
    bun run --cwd packages/desktop dev

前提：`miko` 在 PATH 上可执行（`miko --version`）。若用 workspace 版本，先在 `packages/miko` 跑 `bun link`。

Windows 下若 electron 二进制下载失败（github.com 不可达），设镜像后重装：

    $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
    bun install

## 测试 / 类型

    bun test packages/desktop/src
    bun run --cwd packages/desktop typecheck
