---
name: astro-upgrade
description: "Upgrade Astro across major versions safely. Runs @astrojs/upgrade, reads the official upgrade guide for each major hop, migrates one major at a time on a reversible branch, applies codemods, walks a checklist of historic breaking changes (v3 to v4 to v5 to v6 and later) and verifies with astro check, astro build and a visual diff. Triggers on: Astro upgrade, migrate Astro, Astro 5, Astro 6, Astro 7, @astrojs/upgrade, breaking changes, deprecated Astro API, Astro.glob, output hybrid, ViewTransitions, content layer migration."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: ship
  command: "/astro upgrade [path]"
  tagline: "One major at a time, guided by the official guide, verified by check, build and a visual diff."
  order: 16
---

# Astro Upgrade

Astro ships a major roughly every year, and each one removes APIs the previous
major deprecated. Upgrades go wrong when several majors are jumped at once or
when "it builds" is mistaken for "it works". This skill upgrades one major at a
time, on a branch, with a baseline to diff against.

## When to use

- The scanner reports an old `astroVersion` or findings such as
  `api.astro-glob`, `config.legacy-output-hybrid`, `api.view-transitions-renamed`,
  `content.legacy-config`.
- Deprecation warnings in `astro dev`/`astro build`, or an integration requires a
  newer Astro.
- Security advisories against the current major.

## Workflow

1. **Inventory.** Run `node "${CLAUDE_PLUGIN_ROOT}/skills/astro/scripts/astro-scan.mjs" <path> --json`.
   Record `astroVersion`, adapter, integrations and UI frameworks. Note the Node
   version in use and in CI.
2. **Plan the hops.** List every major between current and target (e.g. 4 -> 5 -> 6).
   For each hop, read the official guide: `https://docs.astro.build/en/guides/upgrade-to/v<N>/`
   (discoverable from `https://docs.astro.build/llms.txt`). Extract the items that
   apply to this project into a checklist. Do not rely on memory for the newest major.
3. **Baseline.** On the current version: `astro check`, `astro build`, save
   `dist/` (or a route list + HTML snapshots) and screenshots of key routes.
   Commit the lockfile.
4. **Branch.** `git switch -c upgrade/astro-v<N>`. One branch (or one commit
   series) per hop so each hop can be reverted independently.
5. **Upgrade packages.** `npx @astrojs/upgrade` (or `npx @astrojs/upgrade <tag>`)
   bumps `astro` and every official `@astrojs/*` integration together. Update
   Node first if the new major requires it. Upgrade community integrations to
   versions that declare support for the new major.
6. **Apply breaking changes** from the hop checklist, starting with config, then
   content, then components. Use provided codemods where the guide offers them;
   otherwise make minimal, mechanical diffs.
7. **Clear caches.** Delete `.astro/` and `node_modules/.vite/` if types or content
   look stale; rerun `astro sync`.
8. **Verify the hop.** `astro check` (0 errors), `astro build` (no deprecation
   warnings you intend to keep), compare `dist/` route list and HTML against the
   baseline, screenshot-diff key routes, run the test suite and Lighthouse on one
   route. Only then start the next hop.
9. **Document.** Summarize changes per hop in the PR body with the guide links.

## Historic breaking changes (verify against the guide)

| Hop | Items that commonly bite |
|-----|--------------------------|
| v2 -> v3 | Node 18+; `astro:assets` stable, `@astrojs/image` removed; `build.split`/`build.excludeMiddleware` moved to adapter options; `Astro.cookies.get()` may return `undefined`; `class:list` behaviour changes |
| v3 -> v4 | Vite 5; Node >= 18.14.1; `markdown.drafts` removed; Shiki major update; `getEntryBySlug`/`getDataEntryById` deprecated in favour of `getEntry`; built-in i18n routing and dev toolbar added |
| v4 -> v5 | Content Layer: `src/content.config.ts` with loaders (`glob`, `file`), `entry.id` replaces `slug`, `render(entry)` from `astro:content`; `output: 'hybrid'` removed (static + per-route `prerender = false`); `<ViewTransitions />` renamed `<ClientRouter />`; `Astro.glob()` deprecated; `astro:env` stable; Squoosh removed; scripts no longer hoisted (rendered where declared); Vite 6 |
| v5 -> v6 | Removals of v5 deprecations (legacy collections, `Astro.glob()`, `<ViewTransitions />`, legacy APIs); higher Node floor; Vite and Zod major bumps (check `z` import path, `astro/zod`); adapter API changes (notably Cloudflare); features graduating from `experimental` (fonts, CSP, etc.) with renamed config keys |
| v6 -> v7+ | Read the guide; expect graduated experimental flags to move out of `experimental`, Node floor changes and adapter majors that must match |

Rows for v6 and later are summaries; the official guide is authoritative.

## Patterns

```ts
// v4 legacy -> v5+ content layer
// before: src/content/config.ts
// const blog = defineCollection({ type: 'content', schema: z.object({ title: z.string() }) });

// after: src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({ title: z.string() }),
});
export const collections = { blog };
```

```astro
---
// before: const { Content } = await entry.render();  and  params: { slug: entry.slug }
import { getCollection, render } from 'astro:content';
export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}
const { post } = Astro.props;
const { Content } = await render(post);
---
<Content />
```

```ts
// before: const posts = await Astro.glob('../posts/*.md');
const posts = Object.values(import.meta.glob('../posts/*.md', { eager: true }));
```

```astro
---
// before: import { ViewTransitions } from 'astro:transitions';
import { ClientRouter } from 'astro:transitions';
---
<head><ClientRouter /></head>
```

```ts
// before: output: 'hybrid'
export default defineConfig({ output: 'static', adapter: node({ mode: 'standalone' }) });
// and in each dynamic route: export const prerender = false;
```

## Checklist

- [ ] Current and target versions recorded; every intermediate major listed.
- [ ] Official upgrade guide read for each hop; applicable items extracted.
- [ ] Baseline build, route list and screenshots captured before changes.
- [ ] One branch/commit series per major; each hop independently revertible.
- [ ] `@astrojs/upgrade` used so official integrations move together.
- [ ] Node version updated locally, in CI and on the host.
- [ ] No removed APIs remain (`Astro.glob`, `output: 'hybrid'`, `<ViewTransitions />`, legacy collections).
- [ ] `astro check` clean, `astro build` clean, route list and visuals match baseline.
- [ ] Deprecation warnings resolved or ticketed.

## Common mistakes

- **Jumping several majors at once.** Errors from different hops mix and cannot be bisected.
- **Upgrading `astro` alone.** Mismatched `@astrojs/*` integration majors fail at runtime.
- **Trusting a green build.** Changed script hoisting, slugs or trailing slashes
  change output silently; diff the routes and HTML.
- **Forgetting CI and host Node.** Local passes, deploy fails.
- **Keeping `entry.slug` URLs** without checking that `entry.id` produces the same paths.

## Output

Return the hop plan (versions, guide links), a per-hop table of breaking changes
applied (file:line, before, after), verification results per hop (check, build,
route diff, visual diff), and the revert command for each hop. Close with at most
three next steps.
