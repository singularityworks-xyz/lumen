#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

junit_parts="${repo_root}/junit_parts"
coverage_parts="${repo_root}/coverage_parts"
merged_junit="${repo_root}/junit.xml"
merged_lcov="${repo_root}/coverage/bun/lcov.info"

# Optional scope filters (space-separated): "web", "workers", "packages"
scopes="${*:-}"

should_run() {
  local label="$1"
  if [[ -z "${scopes}" ]]; then
    return 0
  fi
  for scope in ${scopes}; do
    case "${scope}" in
      web) [[ "${label}" == "web unit tests" ]] && return 0 ;;
      workers) [[ "${label}" == "workers unit tests" ]] && return 0 ;;
      packages) [[ "${label}" == "package unit tests" ]] && return 0 ;;
    esac
  done
  return 1
}

list_test_files() {
  local root="$1"
  shift
  local -a patterns=()

  while (("$#" > 0)); do
    case "$1" in
      -g) patterns+=("$2"); shift 2 ;;
      *) shift ;;
    esac
  done

  if ((${#patterns[@]} == 0)); then
    find "${repo_root}/${root}" -type f | sed "s|^${repo_root}/||" | sort
    return
  fi

  local -a find_args=()
  local first=true
  for pattern in "${patterns[@]}"; do
    if [[ "$first" == true ]]; then
      first=false
    else
      find_args+=(-o)
    fi
    find_args+=(-name "${pattern}")
  done

  find "${repo_root}/${root}" -type f \( "${find_args[@]}" \) -print | sed "s|^${repo_root}/||" | sort
}

list_unit_files() {
  local root="$1"
  shift

  list_test_files "${root}" "$@" | grep -vE '(^|/)integration/|(^|/)(integration|smoke)\.test\.(ts|tsx)$|\.integration\.test\.(ts|tsx)$|\.smoke\.test\.(ts|tsx)$' || true
}

# Generate a unique key from a relative file path.
# Replaces path separators with underscores and strips the test extension.
make_key() {
  local path="$1"
  local key="${path//\//_}"
  key="${key%.test.ts}"
  key="${key%.test.tsx}"
  echo "${key}"
}

run_suite() {
  local label="$1"
  local preload="$2"
  shift 2
  local -a files=("$@")

  if ! should_run "${label}"; then
    return 0
  fi

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
      local key
      key="$(make_key "${file}")"
      local junit_out="${junit_parts}/${key}.xml"
      local cov_dir="${coverage_parts}/${key}"
      mkdir -p "${cov_dir}"

      local -a bun_args=(
        --reporter=junit
        --reporter-outfile="${junit_out}"
        --coverage
        --coverage-dir="${cov_dir}"
      )

      if [[ -n "${preload}" ]]; then
        (cd "${repo_root}" && bun test --preload "${preload}" "${file}" "${bun_args[@]}") || file_exit_code=$?
      else
        (cd "${repo_root}" && bun test "${file}" "${bun_args[@]}") || file_exit_code=$?
      fi
    done
    return ${file_exit_code}
  fi

  local suite_name="${label// /_}"
  local junit_out="${junit_parts}/${suite_name}.xml"
  mkdir -p "${coverage_parts}/${suite_name}"

  local -a bun_args=(
    --reporter=junit
    --reporter-outfile="${junit_out}"
    --coverage
    --coverage-dir="${coverage_parts}/${suite_name}"
  )

  if [[ -n "${preload}" ]]; then
    (cd "${repo_root}" && bun test --preload "${preload}" "${files[@]}" "${bun_args[@]}")
  else
    (cd "${repo_root}" && bun test "${files[@]}" "${bun_args[@]}")
  fi
}

# Clean up old artifacts before starting.
mkdir -p "${junit_parts}"
rm -rf "${coverage_parts}"
mkdir -p "${coverage_parts}"
rm -f "${junit_parts}"/*.xml "${merged_junit}" "${merged_lcov}"

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

# Merge JUnit artifacts
shopt -s nullglob
junit_files=("${junit_parts}"/*.xml)
shopt -u nullglob

if ((${#junit_files[@]} > 0)); then
  (cd "${repo_root}" && bun run scripts/testing/merge-junit.ts "${merged_junit}" "${junit_files[@]}") || exit_code=$?
fi

# Merge coverage artifacts
shopt -s nullglob
lcov_files=("${coverage_parts}"/*/lcov.info)
shopt -u nullglob

if ((${#lcov_files[@]} > 0)); then
  mkdir -p "$(dirname "${merged_lcov}")"
  (cd "${repo_root}" && bun run scripts/testing/merge-lcov.ts --output "${merged_lcov}" "${lcov_files[@]}") || exit_code=$?
fi

exit "${exit_code}"
