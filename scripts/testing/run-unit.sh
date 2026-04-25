#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

list_test_files() {
  local root="$1"
  shift

  (cd "${repo_root}" && { rg --files "${root}" "$@" || true; } | sort)
}

list_unit_files() {
  local root="$1"
  shift

  list_test_files "${root}" "$@" | rg -v '(^|/)integration/|(^|/)(integration|smoke)\.test\.(ts|tsx)$|\.integration\.test\.(ts|tsx)$|\.smoke\.test\.(ts|tsx)$' || true
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

  # Run web and worker tests individually to avoid mock.module cross-
  # contamination between test files (Bun does not isolate mock.module
  # across files when multiple test files are loaded in the same process).
  if [[ "${label}" == "web unit tests" || "${label}" == "workers unit tests" ]]; then
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

mapfile -t web_unit_files < <(
  list_unit_files "apps/web/src" -g '*.test.ts' -g '*.test.tsx'
)
mapfile -t workers_unit_files < <(
  list_unit_files "apps/workers/src" -g '*.test.ts'
)
mapfile -t package_unit_files < <(
  {
    list_unit_files "packages/ai/src" -g '*.test.ts'
    list_unit_files "packages/db/src" -g '*.test.ts'
    list_unit_files "packages/logger/src" -g '*.test.ts'
    list_unit_files "packages/native-bridge/src" -g '*.test.ts'
    list_unit_files "packages/yjs-shared/src" -g '*.test.ts'
  } | sort
)

exit_code=0

run_suite "web unit tests" "./tests/config/web.setup.ts" "${web_unit_files[@]}" || exit_code=$?
run_suite "workers unit tests" "./packages/db/src/setup/workers.setup.ts" "${workers_unit_files[@]}" || exit_code=$?
run_suite "package unit tests" "./tests/config/bun.setup.ts" "${package_unit_files[@]}" || exit_code=$?

exit "${exit_code}"
