#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
XDG_ROOT="${1:-.tmp-steamos-preview}"

cd "$REPO_ROOT"
exec python3 -m backend.dev_shell --xdg-root "$XDG_ROOT"
