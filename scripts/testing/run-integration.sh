#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

list_test_files() {
  local root="$1"
  shift

  (cd "${repo_root}" && { rg --files "${root}" "$@" || true; } | sort)
}

run_suite() {
  local label="$1"
  local preload="$2"
  shift 2
  local -a files=("$@")

  if ((${#files[@]} == 0)); then
    echo "No ${label} found."
    return 0
  fi

  echo "Running ${label} (${#files[@]} files)..."

  # Run web integration tests individually to avoid mock.module
  # cross-contamination between test files.
  if [[ "${label}" == "web integration tests" ]]; then
    local file_exit_code=0
    for file in "${files[@]}"; do
      if [[ -n "${preload}" ]]; then
        (cd "${repo_root}" && bun test --preload "${preload}" "${file}") || file_exit_code=$?
      else
        (cd "${repo_root}" && bun test "${file}") || file_exit_code=$?
      fi
    done
    return ${file_exit_code}
  fi

  if [[ -n "${preload}" ]]; then
    (cd "${repo_root}" && bun test --preload "${preload}" "${files[@]}")
  else
    (cd "${repo_root}" && bun test "${files[@]}")
  fi
}

mapfile -t web_integration_files < <(
  list_test_files "apps/web/src/integration" -g '*.test.ts' -g '*.test.tsx'
)
mapfile -t workers_integration_files < <(
  list_test_files "apps/workers/src/integration" -g '*.test.ts'
)
mapfile -t package_integration_files < <(
  {
    list_test_files "packages/ai/src" -g 'integration.test.ts' -g '*.integration.test.ts'
    list_test_files "packages/db/src/integration" -g '*.test.ts'
    list_test_files "packages/logger/src" -g 'integration.test.ts' -g '*.integration.test.ts'
    list_test_files "packages/native-bridge/src/integration" -g '*.test.ts'
    list_test_files "packages/yjs-shared/src/integration" -g '*.test.ts'
  } | sort
)
mapfile -t app_smoke_files < <(
  {
    list_test_files "apps/landing/src" -g '*.smoke.test.ts' -g '*.smoke.test.tsx'
    list_test_files "apps/native/src-tauri" -g '*.smoke.test.ts' -g '*.smoke.test.tsx'
  } | sort
)

exit_code=0

run_suite "web integration tests" "./tests/config/web.setup.ts" "${web_integration_files[@]}" || exit_code=$?
run_suite "workers integration tests" "./packages/db/src/setup/workers.setup.ts" "${workers_integration_files[@]}" || exit_code=$?
run_suite "package integration tests" "./tests/config/bun.setup.ts" "${package_integration_files[@]}" || exit_code=$?
run_suite "app smoke tests" "" "${app_smoke_files[@]}" || exit_code=$?

exit "${exit_code}"
