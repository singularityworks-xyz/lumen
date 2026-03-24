#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -eq 0 ]; then
  exit 0
fi

files=()

for file in "$@"; do
  if [[ "$file" == apps/presence/* ]] &&
    [[ "$file" == *.ex || "$file" == *.exs ]]; then
    files+=("${file#apps/presence/}")
  fi
done

if [ "${#files[@]}" -eq 0 ]; then
  exit 0
fi

cd apps/presence
mix format --check-formatted "${files[@]}"
