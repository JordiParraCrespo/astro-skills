# astro-skills

Claude Code plugin of generic Astro skills plus the landing site that documents them.

## Layout

- `skills/<name>/SKILL.md` — one skill per directory. `name` must equal the directory. Frontmatter `metadata` (`category`, `command`, `tagline`, `order`, `version`) feeds the landing site.
- `skills/astro/` — the orchestrator. It must route every sub-skill and name every agent (enforced by `npm run validate`).
- `skills/astro/scripts/astro-scan.mjs` — zero-dependency scanner. Adding a rule: add it to `RULES`, trigger it in `tests/fixtures/legacy`, keep `tests/fixtures/clean` finding-free.
- `agents/*.md` — read-only audit subagents used by `astro-audit`.
- `site/` — Astro landing. Its content collections load `../skills/*/SKILL.md` and `../agents/*.md` directly; never duplicate skill copy into the site.

## Commands

```bash
npm run check          # validate structure + scanner tests
npm --prefix site ci   # site deps
npm run build          # build the landing (BASE_PATH / SITE_URL override the Pages defaults)
npm run scan -- <path> # run the scanner
```

## Rules

- Skills stay generic: no project- or company-specific references.
- Never recommend removed Astro APIs (`Astro.glob`, `output: 'hybrid'`, `<ViewTransitions />`, legacy `src/content/config.ts`).
- Bump `version` in `package.json` and `.claude-plugin/plugin.json` together.
