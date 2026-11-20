#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMPIRICAL_DIR="${EMPIRICAL_DIR:-$ROOT/../empirical-api}"
TOOLS_PATH="${TOOLS_PATH:-$ROOT/empirical/tools.ecommerce.json}"
BASE_URL="${BASE_URL:-http://127.0.0.1:8003}"
API_PORT="${API_PORT:-8049}"
LLM_URL="${LLM_URL:-http://127.0.0.1:8080}"

if [[ ! -d "$EMPIRICAL_DIR" ]]; then
  echo "empirical-api not found at $EMPIRICAL_DIR" >&2
  exit 1
fi

if [[ ! -f "$TOOLS_PATH" ]]; then
  echo "tools file not found at $TOOLS_PATH" >&2
  exit 1
fi

cd "$EMPIRICAL_DIR"

if [[ -x .venv/bin/uvicorn ]]; then
  UVICORN=.venv/bin/uvicorn
elif command -v uvicorn >/dev/null 2>&1; then
  UVICORN=uvicorn
else
  echo "uvicorn not found. Install empirical-api requirements first." >&2
  exit 1
fi

echo "Starting empirical-api on :$API_PORT"
echo "  TOOLS_PATH=$TOOLS_PATH"
echo "  BASE_URL=$BASE_URL"
echo "  LLM_URL=$LLM_URL"

exec env \
  TOOLS_PATH="$TOOLS_PATH" \
  BASE_URL="$BASE_URL" \
  LLM_URL="$LLM_URL" \
  "$UVICORN" app.main:app \
  --host 127.0.0.1 \
  --port "$API_PORT" \
  --workers 1
