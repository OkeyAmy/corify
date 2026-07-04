#!/usr/bin/env bash
set -euo pipefail

export CORIFY_DATA_MODE="${CORIFY_DATA_MODE:-fixture}"
export CORIFY_SETTLEMENT_MODE="${CORIFY_SETTLEMENT_MODE:-offline}"

pnpm run build:ts >/dev/null
node dist/scripts/demo.js
