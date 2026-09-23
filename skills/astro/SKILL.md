---
name: astro
description: "Expert Astro engineering for any Astro project (v5+). Routes to specialist sub-skills for project audits, scaffolding, components, islands and hydration, content collections, routing, i18n, SEO, images, performance, styling, Actions, view transitions, accessibility, deployment and version upgrades. Triggers on: Astro, astro.config, .astro files, content collections, islands, client:load, server islands, Astro Actions, getStaticPaths, astro:assets, Astro upgrade, Astro audit."
user-invocable: true
argument-hint: "[command] [path]"
license: MIT
metadata:
  version: "0.1.0"
  category: core
  command: "/astro <command> [path]"
  tagline: "The orchestrator. Detects your project, picks the right specialist, and fans out audits in parallel."
  order: 0
---

# Astro: Orchestrator Skill

**Invocation:** `/astro $1 $2` where `$1` is a command and `$2` is an optional path
(defaults to the current working directory).

This skill is the entry point for every Astro task. It never guesses: it detects
the project first, then routes to the specialist sub-skill whose checklist fits
the task. Every sub-skill is also invocable directly (`/astro-images`, …).

## Quick Reference

| Command | Sub-skill | What it does |
|---------|-----------|--------------|
| `/astro audit [path]` | `astro-audit` | Full project audit, parallel specialist agents, 0–100 score + prioritized plan |
| `/astro init <name>` | `astro-init` | Scaffold a new project with production defaults |
| `/astro components [path]` | `astro-components` | Component architecture, props typing, slots, file conventions |
| `/astro islands [path]` | `astro-islands` | Hydration directives, server islands, JS budget |
| `/astro content [path]` | `astro-content` | Content collections: loaders, schemas, references, rendering |
| `/astro routing [path]` | `astro-routing` | Pages, dynamic routes, endpoints, middleware, redirects |
| `/astro i18n [path]` | `astro-i18n` | i18n routing, locale-aware links, hreflang, translated content |
| `/astro seo [path]` | `astro-seo` | Meta, canonical, Open Graph, JSON-LD, sitemap, robots, llms.txt |
| `/astro images [path]` | `astro-images` | `astro:assets`, responsive images, LCP image priority |
| `/astro perf [path]` | `astro-perf` | Core Web Vitals, Lighthouse budget, CSS/JS/font delivery |
| `/astro styling [path]` | `astro-styling` | Tailwind v4, design tokens, scoped styles, dark mode |
| `/astro actions [path]` | `astro-actions` | Astro Actions + Zod forms with progressive enhancement |
| `/astro transitions [path]` | `astro-transitions` | View transitions, `<ClientRouter />`, script lifecycle |
| `/astro a11y [path]` | `astro-a11y` | WCAG 2.2 audit with native-HTML interactive primitives |
| `/astro deploy [target]` | `astro-deploy` | Adapters, output modes, `astro:env`, headers and caching |
| `/astro upgrade [path]` | `astro-upgrade` | Major-version migration with a verified, reversible plan |
| `/astro scan [path]` | (this skill) | Run the deterministic scanner only and summarize the JSON |

## Step 1: Detect the project (always)

Before routing, run the bundled zero-dependency scanner. It needs only Node ≥18:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/astro/scripts/astro-scan.mjs" <path> --json
```

Manual installs (no plugin) use `~/.claude/skills/astro/scripts/astro-scan.mjs`.
If neither path exists, locate the script with `find ~/.claude -name astro-scan.mjs`.

The scanner reports: Astro version, config file, `output` mode, adapter,
integrations, UI frameworks, page/component/collection counts, and a list of
findings with a severity and a rule id. **Use its facts; do not re-derive them by
hand.** If it reports `isAstroProject: false`, stop and tell the user.

## Step 2: Anchor on the installed version

Astro evolves fast. The API you remember may be renamed or removed in the version
the user has installed. Always:

1. Read `astro` from `package.json` (the scanner reports it as `astroVersion`).
2. When recommending an API you are not certain exists in that major, verify it
   against the official docs index at `https://docs.astro.build/llms.txt` or the
   installed types in `node_modules/astro/`.
3. Never recommend a removed API. Known removals worth remembering:
   `Astro.glob()` (use `import.meta.glob` or content collections),
   `output: 'hybrid'` (static is the default; opt out per page with
   `export const prerender = false`), `<ViewTransitions />` (now `<ClientRouter />`),
   legacy `type: 'content'` collections in `src/content/config.ts` (now loaders in
   `src/content.config.ts`).

## Step 3: Route

Map the user's request to exactly one primary sub-skill using the table above.
If a request spans several areas ("make my blog faster and rank better"), run the
primary sub-skill first and list the follow-ups rather than doing everything at once.

## Orchestration: `/astro audit`

Delegate to the specialist agents **in parallel** (one message, multiple Agent calls),
passing each the scanner JSON so nobody re-scans:

| Agent | Scope |
|-------|-------|
| `astro-architect` | Components, routing, islands, content collections, config hygiene |
| `astro-performance` | Core Web Vitals, images, CSS/JS delivery, fonts, caching |
| `astro-seo` | Metadata, structured data, sitemap/robots, i18n/hreflang |
| `astro-accessibility` | WCAG 2.2 AA across layouts and interactive components |
| `astro-security` | Env handling, Actions/endpoints input validation, headers, dependencies |

Then merge their findings with the `astro-audit` scoring model.

## Output conventions (every sub-skill)

- **Findings are falsifiable.** Each finding names the file and line, the rule it
  violates, the fix, and how to verify the fix worked (a command, a build output,
  a Lighthouse metric).
- **Severity:** `critical` (broken build, security, data loss) → `high` (user-visible
  regression, SEO/a11y failure) → `medium` (measurable cost) → `low` (hygiene).
- **Fixes are minimal diffs** in the project's existing style. Never introduce a UI
  framework, CSS library or runtime dependency the project does not already use
  unless the user asks.
- **End with next steps**: at most three, ordered by impact.

## Principles shared by all sub-skills

1. **Zero JS by default.** Every `client:*` directive must justify itself.
2. **Static first.** Prerender everything that does not need per-request data.
3. **Type everything.** `Props` interfaces, Zod-validated collections, typed env.
4. **Native platform first.** `<dialog>`, `<details>`, the Popover API and CSS beat
   a JavaScript dependency.
5. **Verify with the build.** `astro check` and `astro build` are the ground truth.
