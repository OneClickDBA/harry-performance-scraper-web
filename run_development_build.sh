#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DOCUSAURUS_HOST="${DOCUSAURUS_HOST:-0.0.0.0}"
DOCUSAURUS_PORT="${DOCUSAURUS_PORT:-3001}"

cd "${SCRIPT_DIR}/site"
npm run build
exec npm run serve -- --host "${DOCUSAURUS_HOST}" --port "${DOCUSAURUS_PORT}" "$@"
