#!/usr/bin/env bash
# Lumen local Supermemory server.
#
# Primary path: dockerized via docker/supermemory.Dockerfile (works locally
# and on Dokploy). `bun run infra:up` starts it alongside postgres/redis.
# This script is the non-docker fallback that runs the single binary
# directly.
#
# Config: local/supermemory/supermemory.env (static config) + the gitignored
# root .env (secrets: GENERALCOMPUTE_API_KEY, GEMINI_API_KEY).
#
# First boot prints the API key (sm_...) — copy it into the root .env as
# SUPERMEMORY_API_KEY. See https://supermemory.ai/docs/self-hosting/overview
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [ -f "${SCRIPT_DIR}/supermemory.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/supermemory.env"
  set +a
fi

# Secrets override the static config (sourced later = wins)
if [ -f "${REPO_ROOT}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
fi

export PORT="${SUPERMEMORY_PORT:-6767}"

cd "${SCRIPT_DIR}"
bunx supermemory local start -- --data-dir "${SUPERMEMORY_DATA_DIR:-.supermemory}"
