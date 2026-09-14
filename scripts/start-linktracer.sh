#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
NODE="$ROOT/runtime/node"
if [ ! -x "$NODE" ]; then
  echo "Bundled Node.js runtime not found: $NODE" >&2
  exit 1
fi
mkdir -p "$ROOT/data"
"$NODE" "$ROOT/server/index.js" &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; }
trap cleanup INT TERM EXIT
sleep 2
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:8787" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "http://localhost:8787" >/dev/null 2>&1 || true
fi
wait "$PID"
