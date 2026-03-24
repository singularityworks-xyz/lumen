#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp_dir="${repo_root}/.git-tmp"

mkdir -p "${tmp_dir}"
export TMPDIR="${tmp_dir}"

cd "${repo_root}"
biome ci .

cd "${repo_root}/apps/presence"
mix format --check-formatted
mix compile --warnings-as-errors
mix credo --strict
