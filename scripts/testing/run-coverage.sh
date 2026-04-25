#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

coverage_root="${repo_root}/coverage"
parts_dir="${coverage_root}/parts"
logs_dir="${coverage_root}/logs"
merged_dir="${coverage_root}/merged"
bun_lcov_path="${coverage_root}/bun/lcov.info"
merged_lcov_path="${merged_dir}/lcov.info"

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

run_suite() {
  local label="$1"
  local preload="$2"
  local output_lcov="$3"
  local coverage_threshold="$4"
  local suite_key="$5"
  shift 5
  local -a files=("$@")
  local log_path="${logs_dir}/${suite_key}.log"
  local run_line="Running ${label} (${#files[@]} files)..."

  if ((${#files[@]} == 0)); then
    echo "${run_line} SKIP"
    return 0
  fi

  printf "%s " "${run_line}"

  local -a coverage_flags=(--coverage)
  if [[ -n "${coverage_threshold}" ]]; then
    coverage_flags+=("--coverage-threshold=${coverage_threshold}")
  fi

  rm -f "${bun_lcov_path}"

  local suite_exit_code=0

  if [[ -n "${preload}" ]]; then
    if [[ "${COVERAGE_VERBOSE:-0}" == "1" ]]; then
      (cd "${repo_root}" && bun test --preload "${preload}" "${files[@]}" "${coverage_flags[@]}") || suite_exit_code=$?
    else
      (cd "${repo_root}" && bun test --preload "${preload}" "${files[@]}" "${coverage_flags[@]}") >"${log_path}" 2>&1 || suite_exit_code=$?
    fi
  else
    if [[ "${COVERAGE_VERBOSE:-0}" == "1" ]]; then
      (cd "${repo_root}" && bun test "${files[@]}" "${coverage_flags[@]}") || suite_exit_code=$?
    else
      (cd "${repo_root}" && bun test "${files[@]}" "${coverage_flags[@]}") >"${log_path}" 2>&1 || suite_exit_code=$?
    fi
  fi

  if [[ ! -f "${bun_lcov_path}" ]]; then
    echo "FAIL"
    echo "Coverage output not found at ${bun_lcov_path}" >&2
    return 1
  fi

  cp "${bun_lcov_path}" "${output_lcov}"

  if ((suite_exit_code != 0)); then
    echo "FAIL"
    if [[ "${COVERAGE_VERBOSE:-0}" != "1" ]]; then
      echo "  log: ${log_path}"
    fi
    return "${suite_exit_code}"
  fi

  echo "PASS"
}

mkdir -p "${parts_dir}" "${logs_dir}" "${merged_dir}"
rm -f "${parts_dir}"/*.lcov.info "${merged_lcov_path}"

mapfile -t web_coverage_files < <(
  list_test_files "apps/web/src" -g '*.test.ts' -g '*.test.tsx'
)
mapfile -t workers_coverage_files < <(
  list_test_files "apps/workers/src" -g '*.test.ts'
)
mapfile -t package_coverage_files < <(
  {
    list_test_files "packages/ai/src" -g '*.test.ts'
    list_test_files "packages/db/src" -g '*.test.ts'
    list_test_files "packages/logger/src" -g 'config.test.ts'
    list_test_files "packages/logger/src" -g 'logger.test.ts'
    list_test_files "packages/logger/src" -g 'tracer.test.ts'
    list_test_files "packages/logger/src" -g 'metrics.test.ts'
    list_test_files "packages/native-bridge/src" -g '*.test.ts' | grep -v '/integration/' || true
    list_test_files "packages/yjs-shared/src" -g '*.test.ts' | grep -v '/integration/' || true
  } | sort
)

exit_code=0

run_suite "web coverage tests" "./tests/config/web.setup.ts" "${parts_dir}/apps-web.lcov.info" "0.95" "apps-web" "${web_coverage_files[@]}" || exit_code=$?
run_suite "workers coverage tests" "./packages/db/src/setup/workers.setup.ts" "${parts_dir}/apps-workers.lcov.info" "" "apps-workers" "${workers_coverage_files[@]}" || exit_code=$?
run_suite "package coverage tests" "./tests/config/bun.setup.ts" "${parts_dir}/packages.lcov.info" "" "packages" "${package_coverage_files[@]}" || exit_code=$?

shopt -s nullglob
lcov_parts=("${parts_dir}"/*.lcov.info)
shopt -u nullglob

if ((${#lcov_parts[@]} == 0)); then
  echo "No coverage artifacts were produced." >&2
  exit 1
fi

(cd "${repo_root}" && bun run scripts/testing/merge-lcov.ts --output "${merged_lcov_path}" "${lcov_parts[@]}") || exit_code=$?

if [[ ! -f "${merged_lcov_path}" ]]; then
  echo "Merged coverage artifact was not produced." >&2
  exit 1
fi

echo
echo "Rendering coverage overview..."
BUN_LCOV_PATH="${merged_lcov_path}" bun run scripts/testing/coverage-summary.ts || exit_code=$?

exit "${exit_code}"
