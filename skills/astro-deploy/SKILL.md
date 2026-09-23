---
name: astro-deploy
description: "Deploy Astro projects to production. Chooses static vs server output, installs and configures adapters (Node standalone/middleware, Vercel, Netlify, Cloudflare) with astro add, types environment variables with astro:env envField, and sets per-host headers, redirects, caching, CI builds and previews. Triggers on: Astro deploy, adapter, @astrojs/node, @astrojs/vercel, @astrojs/netlify, @astrojs/cloudflare, output server, prerender, astro:env, envField, environment variables, _headers, redirects, astro preview."
user-invocable: true
argument-hint: "[target]"
license: MIT
metadata:
  version: "0.1.0"
  category: ship
  command: "/astro deploy [target]"
  tagline: "Picks the right output and adapter, types every env var, and ships correct headers and caching per host."
  order: 15
---

# Astro Deploy

Deploying Astro is a small number of decisions made correctly: does anything need
a server, which adapter runs it, which variables are secret, and what the host
should cache. This skill makes those decisions explicit and verifies the build
runs the same way locally and in CI.

## When to use

- First deploy, switching hosts, or adding on-demand routes, Actions or sessions.
- Scanner findings `config.legacy-output-hybrid`, `config.missing-site`,
  `env.process-env`.
- Secrets appear in client bundles, headers or redirects differ between hosts, or
  the preview does not match production.

## Workflow

1. **Scan.** Run `node "${CLAUDE_PLUGIN_ROOT}/skills/astro/scripts/astro-scan.mjs" <path> --json`;
   read `output`, `adapter` and the `config.*`/`env.*` findings.
2. **Choose output.**
   | Need | Config |
   |------|--------|
   | Everything known at build time | `output: 'static'` (default), no adapter |
   | Mostly static, a few dynamic routes/Actions/server islands | `output: 'static'` + adapter + `export const prerender = false` on those routes |
   | Mostly dynamic (auth, per-user pages) | `output: 'server'` + adapter; `export const prerender = true` on static pages |
   `output: 'hybrid'` was removed in v5; the second row replaces it.
3. **Install the adapter** with `npx astro add node|vercel|netlify|cloudflare`.
   It installs the package and edits the config. Node: `mode: 'standalone'` for
   its own server, `'middleware'` to mount in Express/Fastify.
4. **Type the environment.** Declare every variable in `env.schema` with
   `envField`. `context: 'client'` requires `access: 'public'`; secrets are
   `context: 'server', access: 'secret'` and are read only from `astro:env/server`.
   Replace `process.env` / ad hoc `import.meta.env` reads. Never prefix a secret
   with `PUBLIC_`: that inlines it into client JS.
5. **Security defaults.** Keep `security.checkOrigin` enabled for on-demand
   routes (it protects form posts). Add security headers per host.
6. **Headers, redirects, caching.** Put `redirects` in `astro.config` (adapters
   translate them where supported). Cache `/_astro/*` as
   `public, max-age=31536000, immutable`; HTML short or revalidated. Use the
   host's mechanism for headers (table below).
7. **CI.** Pin Node to the version the installed Astro major requires (check
   `engines` in `node_modules/astro/package.json`). Run
   `astro check && astro build` on every PR, with env vars provided as CI secrets.
8. **Preview.** `astro preview` works for static and for adapters that support it
   (Node does). For edge hosts use the host CLI (`wrangler`, `netlify dev`, `vercel dev`)
   or a preview deployment.
9. **Verify.** Build locally with production env, confirm prerendered routes are
   in `dist/` (or `dist/client/`), grep the client output for secret values
   (`rg -n "<secret-prefix>" dist/client dist/_astro`), then check headers on the
   preview with `curl -sI`.

## Host reference

| Host | Adapter | Headers / redirects |
|------|---------|--------------------|
| Static CDN / any | none | Host config (`_headers`, nginx, bucket metadata) |
| Node server / container | `@astrojs/node` | Reverse proxy or middleware; run `node dist/server/entry.mjs` |
| Vercel | `@astrojs/vercel` | `vercel.json` `headers` / `redirects`; ISR options on the adapter |
| Netlify | `@astrojs/netlify` | `public/_headers`, `public/_redirects` or `netlify.toml` |
| Cloudflare | `@astrojs/cloudflare` | `public/_headers`, `public/_redirects`; bindings via the adapter's runtime API |

Adapter options change between majors (e.g. Cloudflare runtime access). Check the
installed adapter version and its docs page before copying options.

## Patterns

```ts
// astro.config.mjs
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://example.com',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  security: { checkOrigin: true },
  redirects: { '/old-blog/[...slug]': '/blog/[...slug]' },
  env: {
    schema: {
      PUBLIC_ANALYTICS_DOMAIN: envField.string({ context: 'client', access: 'public', optional: true }),
      API_BASE_URL: envField.string({ context: 'server', access: 'public', url: true }),
      API_TOKEN: envField.string({ context: 'server', access: 'secret' }),
    },
  },
});
```

```astro
---
// src/pages/status.astro, rendered on demand; secrets stay on the server
export const prerender = false;
import { API_BASE_URL, API_TOKEN } from 'astro:env/server';
const res = await fetch(new URL('/status', API_BASE_URL), {
  headers: { Authorization: `Bearer ${API_TOKEN}` },
});
const status = await res.json();
---
<p>Status: {status.state}</p>
```

```yaml
# .github/workflows/ci.yml (excerpt)
- uses: actions/setup-node@v4
  with: { node-version-file: '.nvmrc', cache: 'pnpm' }
- run: pnpm install --frozen-lockfile
- run: pnpm astro check && pnpm astro build
  env:
    API_BASE_URL: ${{ vars.API_BASE_URL }}
    API_TOKEN: ${{ secrets.API_TOKEN }}
```

## Checklist

- [ ] Output mode matches the need; no `output: 'hybrid'`.
- [ ] Adapter installed via `astro add` only when something renders on demand.
- [ ] Every env var declared with `envField`; secrets `server`/`secret`; no `process.env`.
- [ ] No secret uses the `PUBLIC_` prefix; client bundle grep is clean.
- [ ] `site` set; `security.checkOrigin` not disabled.
- [ ] `/_astro/*` immutable; HTML revalidated; security headers set per host.
- [ ] Redirects in config or host file, not duplicated in both.
- [ ] CI pins Node to the Astro major's requirement and runs `astro check` + `astro build`.
- [ ] Preview verified with `curl -sI` for headers and status codes.

## Common mistakes

- **Adding `output: 'server'` for one form.** Keep static; opt that route out.
- **Reading secrets in client scripts.** `astro:env/server` imports fail in client
  code by design; do not work around it with `PUBLIC_`.
- **Missing runtime env on the host.** `astro:env` validates at build and/or
  startup; set variables in the host dashboard too.
- **Wrong Node version** on the host causing opaque build failures.
- **Assuming `astro preview` equals the edge runtime.** Test with the host CLI.

## Output

Return the chosen output mode and adapter with reasoning, the env schema, the
host-specific header/redirect files, the CI snippet, and the verification
commands with their results. Close with at most three next steps.
