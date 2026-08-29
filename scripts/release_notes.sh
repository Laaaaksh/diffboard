#!/usr/bin/env bash
# Extracts one version's section from CHANGELOG.md for use as GitHub release
# notes. Fails loudly rather than publishing empty notes when the version
# has no changelog entry yet.
set -euo pipefail

version="${1:?usage: release_notes.sh <version, e.g. 0.2.0>}"

awk -v version="$version" '
  BEGIN { found = 0; printing = 0 }
  /^## \[/ {
    if (printing) exit
    if ($0 ~ "\\[" version "\\]") { found = 1; printing = 1; next }
  }
  printing { print }
  END { if (!found) { print "::error::No CHANGELOG.md section found for version " version > "/dev/stderr"; exit 1 } }
' CHANGELOG.md
