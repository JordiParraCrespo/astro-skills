#!/usr/bin/env bash
# Removes exactly what install.sh copied, using its manifest.
set -euo pipefail

DEST="${CLAUDE_HOME:-$HOME/.claude}"
MANIFEST="$DEST/.astro-skills-manifest"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Nothing to uninstall: $MANIFEST not found." >&2
  exit 0
fi

while IFS= read -r entry; do
  [[ -n "$entry" && "$entry" != *..* ]] && rm -rf "${DEST:?}/$entry"
done < "$MANIFEST"
rm -f "$MANIFEST"
echo "✓ Removed astro-skills from $DEST"
