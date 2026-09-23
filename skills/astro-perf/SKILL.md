---
name: astro-perf
description: "Performance and Core Web Vitals for Astro projects. Sets a Lighthouse mobile budget, maps LCP/CLS/INP to Astro-specific causes, and fixes CSS delivery (build.inlineStylesheets), prefetch strategy, font loading, third-party scripts, bundle size and caching headers for hashed assets. Triggers on: Astro performance, Lighthouse, Core Web Vitals, LCP, CLS, INP, slow Astro site, prefetch, inlineStylesheets, Astro fonts, Partytown, bundle size, cache headers."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: performance
  command: "/astro perf [path]"
  tagline: "Holds a Lighthouse mobile budget by fixing the Astro-specific causes of slow LCP, CLS and INP."
  order: 10
---

# Astro Performance

Astro ships zero JS by default, so a slow Astro site is almost always slow for a
specific, fixable reason: a hydrated island, a render-blocking font, an
unoptimized hero, a third-party tag. This skill measures first, maps each Core
Web Vital to its Astro cause, and fixes in order of impact.

## When to use

- Lighthouse mobile performance below budget, or CrUX/Search Console CWV failing.
- Scanner findings `islands.client-load`, `images.raw-img`, `deps.multiple-frameworks`.
- Adding fonts, analytics, chat widgets or a heavy island; before a launch.

## Workflow

1. **Baseline.** `astro build && astro preview`, then
   `npx lighthouse http://localhost:4321/ --preset=perf --form-factor=mobile --output=json --output-path=./lh.json`
   (mobile is the default form factor). Record Performance, LCP, CLS, TBT (lab proxy
   for INP) for the 3-5 most important routes. Set a budget (e.g. score >= 95,
   LCP <= 2.5s, CLS <= 0.1, TBT <= 200ms) and keep it in the repo.
2. **Map each failing metric to a cause** using the table below. Fix the LCP
   element first; it is usually one image or one font.
3. **CSS delivery.** `build.inlineStylesheets: 'auto'` (default) inlines small
   stylesheets; `'always'` removes the render-blocking request entirely and suits
   small, mostly-static sites. Measure: `'always'` repeats CSS on every page.
4. **JS.** List islands (`rg -n "client:" src`). Downgrade `client:load` to
   `client:visible`/`client:idle`, replace with native HTML, or move to a server
   island. See `astro-islands`.
5. **Fonts.** Use the Fonts API where the installed version has it (experimental
   in 5.x under `experimental.fonts`, top-level `fonts` in later majors; check
   `package.json` and https://docs.astro.build/llms.txt). Otherwise self-host
   WOFF2 subsets, `font-display: swap`, preload only the one or two faces used
   above the fold, and use `size-adjust` fallbacks to cut CLS. Or use a system stack.
6. **Prefetch.** Enable `prefetch` with `defaultStrategy: 'hover'` (or `'viewport'`
   for small nav sets). Avoid `prefetchAll` with `'load'` on large sites.
7. **Third parties.** Inventory every external `<script>`. Remove, defer, or load
   after consent/interaction. Use Partytown only for heavy scripts that tolerate a
   worker (analytics tags), never for scripts that must touch the DOM synchronously.
8. **Bundle analysis.** Add `rollup-plugin-visualizer` under `vite.plugins` for
   one build to find oversized dependencies in `dist/_astro/`.
9. **Caching.** Hashed assets in `/_astro/` get
   `Cache-Control: public, max-age=31536000, immutable`; HTML gets a short or
   revalidating policy. Configure per host (see `astro-deploy`).
10. **Verify.** Rebuild, rerun the same Lighthouse command on the same routes, and
    report before/after per metric. Run 3 times and take the median.

## CWV cause map

| Metric | Common Astro causes | Fix |
|--------|--------------------|-----|
| LCP | Hero via raw `<img>` or lazy-loaded; webfont blocking the heading; render-blocking CSS | `<Image>`/`<Picture>` with `loading="eager"` + `fetchpriority="high"`; preload the font; inline CSS |
| CLS | Images without dimensions; font swap metric mismatch; late-mounting islands; injected banners | `astro:assets` dimensions; fallback `size-adjust`; reserve island space with `min-height`; overlay banners |
| INP | `client:load` frameworks hydrating on load; heavy third-party tags; long tasks in scripts | Lazier directives or no island; defer third parties; split work with `scheduler.yield()`/`requestIdleCallback` |
| TTFB | SSR route doing slow fetches; no CDN caching | Prerender; cache headers; server islands for the dynamic part |

## Patterns

```ts
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example.com',
  build: { inlineStylesheets: 'always' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  // vite: { plugins: [visualizer({ filename: 'stats.html', gzipSize: true })] },
});
```

```astro
<!-- Opt specific links into prefetch -->
<a href="/pricing" data-astro-prefetch="viewport">Pricing</a>
```

```astro
---
// Self-hosted fallback when the Fonts API is unavailable
import interWoff2 from '../assets/fonts/inter-var-latin.woff2?url';
---
<link rel="preload" href={interWoff2} as="font" type="font/woff2" crossorigin />
<style is:global define:vars={{ src: `url(${interWoff2})` }}>
  @font-face {
    font-family: 'Inter';
    src: var(--src) format('woff2');
    font-weight: 100 900;
    font-display: swap;
  }
</style>
```

> Prefer a plain CSS `@font-face` in your global stylesheet when the font URL is
> static; the pattern above only shows how to keep the preload and the face
> pointing at the same hashed file.

```text
# public/_headers (Netlify / Cloudflare Pages)
/_astro/*
  Cache-Control: public, max-age=31536000, immutable
```

## Checklist

- [ ] A written Lighthouse mobile budget exists and key routes meet it.
- [ ] The LCP element per route is identified and eager/high-priority.
- [ ] No render-blocking font or stylesheet the page can avoid.
- [ ] Every `client:*` directive is justified; no `client:load` below the fold.
- [ ] One UI framework at most (`deps.multiple-frameworks`).
- [ ] Prefetch configured with a deliberate strategy.
- [ ] Third-party scripts deferred, consent-gated, or removed.
- [ ] `/_astro/*` cached immutable; HTML not cached immutable.
- [ ] Before/after numbers recorded from the same command.

## Common mistakes

- **Measuring `astro dev`.** Dev is unbundled and unoptimized; always measure a build.
- **Desktop-only scores.** The budget is mobile; desktop hides CPU-bound INP issues.
- **Preloading every font weight.** Preload competes with the LCP image.
- **Partytown as a default.** It adds complexity and breaks DOM-dependent scripts.
- **Immutable caching on HTML.** Deploys stop reaching users.
- **Chasing 100 on one run.** Lighthouse varies; use medians.

## Output

Return the budget, a before/after table per route (score, LCP, CLS, TBT, JS KB,
CSS KB), findings with file:line and the CWV they affect, the applied diff, and
the exact Lighthouse command used. Close with at most three next steps.
