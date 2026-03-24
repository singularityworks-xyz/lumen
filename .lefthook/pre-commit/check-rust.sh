#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -eq 0 ]; then
  exit 0
fi

root_dir="$(git rev-parse --show-toplevel)"
files=()

for file in "$@"; do
  if [[ "$file" == apps/native/src-tauri/* ]] && [[ "$file" == *.rs ]]; then
    files+=("${root_dir}/${file}")
  fi
done

if [ "${#files[@]}" -eq 0 ]; then
  exit 0
fi

rustfmt --check --edition 2021 "${files[@]}"
