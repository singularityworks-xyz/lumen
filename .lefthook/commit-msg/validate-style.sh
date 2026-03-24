#!/usr/bin/env bash

set -euo pipefail

message_file="${1:-}"

if [ -z "$message_file" ] || [ ! -f "$message_file" ]; then
  echo "commit-msg hook requires the commit message file path." >&2
  exit 1
fi

message="$(sed -n '1p' "$message_file")"
pattern='^[a-z]+(\[[A-Za-z0-9_-]+\])?: .+'

if [[ ! "$message" =~ $pattern ]]; then
  echo "Invalid commit message: $message" >&2
  echo "Expected format: type[SCOPE]: subject" >&2
  echo "Example: chore[LINT]: tighten staged hook checks" >&2
  exit 1
fi
