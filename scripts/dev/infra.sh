#!/usr/bin/env bash
# Lumen local infra (docker compose) wrapper.
#
# Passes the gitignored root .env as the compose env-file so services can
# interpolate secrets (e.g. GENERALCOMPUTE_API_KEY / GEMINI_API_KEY for the
# supermemory container) without committing them.
#
# After `up`, auto-syncs the Supermemory API key (printed on first boot)
# from the container logs into the root .env, so the workers server picks it
# up on next start — no manual copying.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_file="${repo_root}/local/docker/docker-compose.dev.yml"
cmd="${1:-up}"

# First run: create the gitignored secrets file from the template
if [ ! -f "${repo_root}/.env" ]; then
  cp "${repo_root}/.env.example" "${repo_root}/.env"
  echo "infra: created .env from .env.example — fill in your real keys"
fi

compose_args=(-f "${compose_file}")
if [ -f "${repo_root}/.env" ]; then
  compose_args+=(--env-file "${repo_root}/.env")
fi

sync_supermemory_key() {
  local env_file="${repo_root}/.env"
  local container_name="lumensupermemory"

  [ -f "${env_file}" ] || return 0

  # Only auto-sync when the key is unset or still a placeholder — a real
  # user-managed key (e.g. pointing at a remote Supermemory) is never clobbered
  local current
  current="$(grep '^SUPERMEMORY_API_KEY=' "${env_file}" | head -1 | cut -d= -f2- || true)"
  if [ -n "${current}" ] && [ "${current}" != "sm_..." ]; then
    return 0
  fi

  local key=""
  local attempt
  for attempt in $(seq 1 30); do
    key="$(docker logs "${container_name}" 2>/dev/null \
      | grep -oE 'sm_[A-Za-z0-9_-]{20,}' | head -1 || true)"
    if [ -n "${key}" ]; then
      break
    fi
    sleep 2
  done

  if [ -z "${key}" ]; then
    echo "infra: supermemory container not ready yet — run 'docker logs ${container_name} | grep api key' and set SUPERMEMORY_API_KEY manually"
    return 0
  fi

  if grep -q '^SUPERMEMORY_API_KEY=' "${env_file}"; then
    sed -i "s|^SUPERMEMORY_API_KEY=.*|SUPERMEMORY_API_KEY=${key}|" "${env_file}"
  else
    printf '\n# Auto-synced from the supermemory container by infra:up\nSUPERMEMORY_API_KEY=%s\n' "${key}" >> "${env_file}"
  fi
  echo "infra: synced SUPERMEMORY_API_KEY into .env (restart the workers server to pick it up)"
}

case "${cmd}" in
  up)
    docker compose "${compose_args[@]}" up -d
    sync_supermemory_key
    ;;
  down)
    docker compose "${compose_args[@]}" down
    ;;
  *)
    echo "usage: $0 [up|down]" >&2
    exit 1
    ;;
esac
