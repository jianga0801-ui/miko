#!/usr/bin/env bash
set -euo pipefail

source_path="${BASH_SOURCE[0]:-}"
if [ -n "$source_path" ] && [ -f "$source_path" ] && [ -f "$(dirname "$source_path")/install" ]; then
  exec "$(dirname "$source_path")/install" "$@"
fi

curl -fsSL https://raw.githubusercontent.com/jianga0801-ui/miko/dev/install | bash -s -- "$@"
