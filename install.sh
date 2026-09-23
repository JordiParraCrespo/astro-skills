#!/usr/bin/env bash
# Manual install: copies skills and agents into ~/.claude (or $CLAUDE_HOME).
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${CLAUDE_HOME:-$HOME/.claude}"
MANIFEST="$DEST/.astro-skills-manifest"

command -v node >/dev/null 2>&1 || echo "warning: node not found; the scanner (astro-scan.mjs) needs Node 18+." >&2

mkdir -p "$DEST/skills" "$DEST/agents"
: > "$MANIFEST"

for dir in "$SRC"/skills/*/; do
  name="$(basename "$dir")"
  rm -rf "$DEST/skills/$name"
  cp -R "$dir" "$DEST/skills/$name"
  # Plugin installs resolve ${CLAUDE_PLUGIN_ROOT}; manual installs point at ~/.claude.
  find "$DEST/skills/$name" -name '*.md' -exec sed -i.bak "s|\${CLAUDE_PLUGIN_ROOT}/skills/|$DEST/skills/|g" {} +
  find "$DEST/skills/$name" -name '*.bak' -delete
  echo "skills/$name" >> "$MANIFEST"
done

for file in "$SRC"/agents/*.md; do
  name="$(basename "$file")"
  cp "$file" "$DEST/agents/$name"
  sed -i.bak "s|\${CLAUDE_PLUGIN_ROOT}/skills/|$DEST/skills/|g" "$DEST/agents/$name" && rm -f "$DEST/agents/$name.bak"
  echo "agents/$name" >> "$MANIFEST"
done

count_skills=$(grep -c '^skills/' "$MANIFEST")
count_agents=$(grep -c '^agents/' "$MANIFEST")
echo "✓ Installed $count_skills skills and $count_agents agents into $DEST"
echo "  Start Claude Code in an Astro project and run: /astro audit"
