---
name: astro-init
description: "Scaffold a new Astro project (v5+) with production defaults: create-astro minimal template, strict TypeScript, site URL, sitemap, robots.txt, typed astro:env schema, Tailwind v4 via @tailwindcss/vite, Prettier with prettier-plugin-astro, a BaseLayout with a complete SEO head, and a 404 page. Triggers on: new Astro project, create astro, npm create astro, scaffold Astro, Astro starter, bootstrap Astro site, Astro boilerplate, set up Astro."
user-invocable: true
argument-hint: "<name>"
license: MIT
metadata:
  version: "0.1.0"
  category: foundations
  command: "/astro init <name>"
  tagline: "Scaffolds a new project with strict types, sitemap, robots, typed env, Tailwind v4 and an SEO-ready layout."
  order: 2
---

# Astro Init

Start from the official minimal template, then layer the production defaults that
every real site ends up needing. Doing it on day one is cheaper than retrofitting,
and a fresh scaffold should already pass `/astro audit` with a score of 90+.

## When to use

- Creating a new Astro site or app from scratch.
- Replacing a starter that shipped with demo content, a UI framework or loose types.
- Not for existing projects: audit them with `/astro audit` and fix per finding.

## Workflow

1. **Create.** Use the official CLI with the minimal template (no demo content):
   ```bash
   npm create astro@latest <name> -- --template minimal --install --git --yes
   cd <name>
   ```
   Read `astro` from the generated `package.json`; flags and defaults change between
   majors, so confirm against `npm create astro@latest -- --help` and
   `https://docs.astro.build/llms.txt`.
2. **Integrations via `astro add`** (it edits config and installs deps together):
   ```bash
   npx astro add sitemap tailwind --yes
   ```
   Recent `astro add tailwind` installs Tailwind v4 through `@tailwindcss/vite` and
   creates `src/styles/global.css`. If it installs the deprecated
   `@astrojs/tailwind` instead, the Astro major is old: wire `@tailwindcss/vite`
   manually (see the `astro-styling` skill).
3. **Config.** Set `site` (required for sitemap and canonical URLs), keep static
   output, and declare the env schema (Patterns below).
4. **TypeScript.** `tsconfig.json` extends `astro/tsconfigs/strict` (or
   `strictest`) and includes the generated `.astro/types.d.ts`.
5. **Formatting.** `npm i -D prettier prettier-plugin-astro` plus `.prettierrc`.
6. **Layout + pages.** Add `src/layouts/BaseLayout.astro` with the SEO head,
   `src/pages/404.astro`, and `src/pages/robots.txt.ts`.
7. **Scripts.** Add `"check": "astro check"` (install `@astrojs/check` and
   `typescript` as dev deps) and `"format": "prettier --write ."`.
8. **Verify.** `npm run check && npm run build`, then confirm
   `dist/sitemap-index.xml`, `dist/robots.txt` and `dist/404.html` exist, and run
   the scanner: `node "${CLAUDE_PLUGIN_ROOT}/skills/astro/scripts/astro-scan.mjs" . --json`
   should report no `config.missing-site`, `config.no-sitemap`, `seo.no-robots`,
   `seo.no-canonical`, `ts.not-strict` or `env.process-env` findings.

## Patterns

```js
// astro.config.mjs
// @ts-check
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://example.com',
  trailingSlash: 'never',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
  env: {
    schema: {
      PUBLIC_ANALYTICS_DOMAIN: envField.string({ context: 'client', access: 'public', optional: true }),
      API_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
```

```json
// tsconfig.json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": { "paths": { "@/*": ["./src/*"] } }
}
```

```json
// .prettierrc
{
  "plugins": ["prettier-plugin-astro"],
  "overrides": [{ "files": "*.astro", "options": { "parser": "astro" } }]
}
```

```ts
// src/pages/robots.txt.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
```

```astro
---
// src/layouts/BaseLayout.astro
import '@/styles/global.css';

interface Props {
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
}

const { title, description, image = '/og.png', noindex = false } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);
const ogImage = new URL(image, Astro.site);
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    {noindex && <meta name="robots" content="noindex" />}
    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={ogImage} />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="sitemap" href="/sitemap-index.xml" />
    <meta name="generator" content={Astro.generator} />
  </head>
  <body>
    <a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>
    <main id="main"><slot /></main>
  </body>
</html>
```

```astro
---
// src/pages/404.astro
import BaseLayout from '@/layouts/BaseLayout.astro';
---
<BaseLayout title="Page not found" description="This page does not exist." noindex>
  <h1>Page not found</h1>
  <p><a href="/">Go to the home page</a></p>
</BaseLayout>
```

Read env through the typed modules, never `process.env`:
`import { API_TOKEN } from 'astro:env/server';`.

## Checklist

- [ ] Created from the `minimal` template; no demo content left behind.
- [ ] `site` set to the production origin.
- [ ] `@astrojs/sitemap` installed; `robots.txt` references the sitemap.
- [ ] `tsconfig.json` extends `astro/tsconfigs/strict` or `strictest`.
- [ ] Every env var declared in `env.schema`; secrets use `context: 'server', access: 'secret'`.
- [ ] Tailwind v4 via `@tailwindcss/vite`; `global.css` starts with `@import 'tailwindcss';`.
- [ ] Prettier + `prettier-plugin-astro` configured.
- [ ] `BaseLayout` sets `lang`, title, description, canonical, Open Graph, viewport.
- [ ] `404.astro` exists and is `noindex`.
- [ ] `astro check` and `astro build` pass; no UI framework installed unless needed.

## Common mistakes

- **Leaving `site` unset.** Sitemap generation is skipped and canonical/OG URLs
  resolve against `localhost`.
- **Adding `output: 'server'` "just in case".** Static is the default and the fastest.
  Add an adapter and `export const prerender = false` only on routes that need it.
  `output: 'hybrid'` no longer exists.
- **Installing `@astrojs/tailwind`.** It targets Tailwind v3 and is deprecated.
- **Adding React/Vue/Svelte by default.** Add a UI framework only for a real island.
- **Reading `import.meta.env.SECRET` in components.** It is untyped and easy to leak
  to the client; declare it in `env.schema` and import from `astro:env/server`.

## Output

Report the created path, the installed Astro major, the files added or changed (one
line each), the output of `astro check` and `astro build`, and the scanner result.
Next steps: set the real `site` and OG image, then `/astro components` or
`/astro content` for the first real feature.
