#!/usr/bin/env bash
#
# Merge multiple JUnit XML files into a single XML file.
# Usage: merge-junit.sh <output.xml> <input1.xml> [input2.xml ...]

set -euo pipefail

output="${1:?Usage: merge-junit.sh <output.xml> <input...>}"
shift

inputs=("$@")

if ((${#inputs[@]} == 0)); then
  echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?><testsuites></testsuites>" >"${output}"
  exit 0
fi

mkdir -p "$(dirname "${output}")"

{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<testsuites>'

  for file in "${inputs[@]}"; do
    if [[ -f "${file}" ]]; then
      # Strip XML declaration and outer <testsuites> / </testsuites> tags.
      # Use a regex that handles attributes on the <testsuites> tag.
      sed -n '/<testsuites\b/,/<\/testsuites>/p' "${file}" | sed '1d;$d' || true
    fi
  done

  echo '</testsuites>'
} >"${output}"
