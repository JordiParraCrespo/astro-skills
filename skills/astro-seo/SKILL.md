---
name: astro-seo
description: "Technical SEO for Astro projects. Audits and builds the layout head (title template, description, canonical, Open Graph, Twitter), JSON-LD structured data, @astrojs/sitemap with i18n, robots.txt, llms.txt and RSS endpoints, and noindex on error pages. Triggers on: Astro SEO, meta tags, canonical URL, Open Graph, og:image, JSON-LD, structured data, sitemap, robots.txt, llms.txt, RSS feed, hreflang, Astro.site."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: quality
  command: "/astro seo [path]"
  tagline: "One typed head component, correct canonicals, JSON-LD, sitemap, robots, llms.txt and RSS, verified in dist/."
  order: 12
---

# Astro SEO

Astro renders HTML on the server, so most SEO work is about emitting the right
tags once, from one place, with absolute URLs. This skill centralizes metadata in
a typed head component, derives every URL from `Astro.site`, and adds the
crawler-facing endpoints (sitemap, robots, llms.txt, RSS).

## When to use

- Lighthouse SEO < 100, or Search Console reports duplicate/missing canonicals.
- Scanner findings `config.missing-site`, `config.no-sitemap`, `seo.no-robots`,
  `seo.no-canonical` or `links.hardcoded-internal`.
- Launching a site, adding a blog/feed, adding locales, or social previews look wrong.

## Workflow

1. **Scan.** Run `node "${CLAUDE_PLUGIN_ROOT}/skills/astro/scripts/astro-scan.mjs" <path> --json`
   and read the `seo.*`, `config.missing-site`, `config.no-sitemap` findings.
2. **Set `site`.** Every absolute URL (canonical, OG, sitemap, RSS) depends on
   `site` in `astro.config.*`. Without it `Astro.site` is `undefined` and the
   sitemap integration emits nothing. Also decide `trailingSlash` and keep it
   consistent with how the host serves pages.
3. **One head component.** Find every `<title>`/`<meta>` in layouts and pages
   (`rg -n "<title|<meta|og:" src`). Consolidate into `src/components/Seo.astro`
   (or the project's equivalent) rendered once by the base layout; pages pass
   props through the layout.
4. **Canonical.** `new URL(Astro.url.pathname, Astro.site)`; never include query
   strings; let a page override it (paginated/duplicated content).
5. **Social.** `og:title`, `og:description`, `og:url`, `og:type`, `og:image`
   (absolute, 1200x630), `twitter:card=summary_large_image`. Generate the OG
   image URL with `getImage()` if it lives in `src/assets/`.
6. **Structured data.** Emit JSON-LD per page type (`WebSite`, `Organization`,
   `Article`/`BlogPosting`, `BreadcrumbList`, `Product`). Compose several nodes
   via `@graph`. `schema-dts` types are optional but catch typos at build time.
7. **Crawler endpoints.** Add `@astrojs/sitemap` (`npx astro add sitemap`),
   `src/pages/robots.txt.ts`, optionally `src/pages/llms.txt.ts` and an RSS
   feed with `@astrojs/rss`.
8. **i18n.** With locales, configure the sitemap `i18n` option and emit
   `<link rel="alternate" hreflang>` per locale plus `x-default`
   (see the `astro-i18n` skill for URL helpers).
9. **Errors and drafts.** `404.astro` gets `<meta name="robots" content="noindex">`;
   drafts and staging builds must not be indexed.
10. **Verify.** `astro build`, then inspect `dist/`: one `<title>` and one
    canonical per page, `sitemap-index.xml` present, `robots.txt` references it,
    JSON-LD passes the Rich Results Test / `validator.schema.org`.

## Patterns

```astro
---
// src/components/Seo.astro
interface Props {
  title: string;
  description: string;
  image?: string;          // absolute or root-relative
  canonical?: string;
  noindex?: boolean;
  type?: 'website' | 'article';
  jsonLd?: Record<string, unknown>[];
}
const { title, description, image = '/og-default.png', canonical, noindex = false,
        type = 'website', jsonLd = [] } = Astro.props;
const siteName = 'Example';
const fullTitle = title === siteName ? title : `${title} | ${siteName}`;
const canonicalUrl = new URL(canonical ?? Astro.url.pathname, Astro.site);
const imageUrl = new URL(image, Astro.site);
const graph = { '@context': 'https://schema.org', '@graph': jsonLd };
---
<title>{fullTitle}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonicalUrl} />
{noindex && <meta name="robots" content="noindex, follow" />}
<meta property="og:type" content={type} />
<meta property="og:title" content={fullTitle} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonicalUrl} />
<meta property="og:image" content={imageUrl} />
<meta name="twitter:card" content="summary_large_image" />
{jsonLd.length > 0 && (
  <script type="application/ld+json" set:html={JSON.stringify(graph)} />
)}
```

`set:html` with `JSON.stringify` is the correct way to emit JSON-LD; the data is
build-time and trusted. If any field is user-supplied, escape `<` as `<`
first (the scanner flags `security.set-html` for review).

```ts
// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/drafts/'),
      i18n: { defaultLocale: 'en', locales: { en: 'en-US', es: 'es-ES' } },
    }),
  ],
});
```

```ts
// src/pages/robots.txt.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
```

```ts
// src/pages/rss.xml.ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return rss({
    title: 'Example Blog',
    description: 'Notes on building for the web',
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title, pubDate: p.data.pubDate,
      description: p.data.description, link: `/blog/${p.id}/`,
    })),
  });
}
```

An `llms.txt` endpoint follows the same shape as `robots.txt.ts`: a Markdown
body with an H1, a one-line summary and a list of key URLs built from
`getCollection()`. Link the RSS feed from the head with
`<link rel="alternate" type="application/rss+xml" href="/rss.xml">`.

## Checklist

- [ ] `site` set in `astro.config`; `trailingSlash` matches the host.
- [ ] Exactly one `<title>`, description and canonical per page, from one component.
- [ ] Canonical is absolute, query-free, and self-referencing unless overridden.
- [ ] OG/Twitter tags present with an absolute 1200x630 image.
- [ ] JSON-LD valid, emitted via `set:html={JSON.stringify(...)}`, composed with `@graph`.
- [ ] `@astrojs/sitemap` installed; drafts/private routes filtered; i18n mapped.
- [ ] `robots.txt` exists and references the sitemap; staging disallows all.
- [ ] Internal links are root-relative or built with locale helpers (no hardcoded hosts).
- [ ] `404` page is `noindex`; RSS and `llms.txt` present where content warrants.
- [ ] `hreflang` alternates + `x-default` on every localized page.

## Common mistakes

- **Missing `site`.** Canonicals become relative or `undefined`; the sitemap is
  silently skipped.
- **Canonical from `Astro.url.href`.** Leaks query strings and the dev host.
- **Duplicated head tags.** Layout and page both emit `<title>`; crawlers pick one
  unpredictably.
- **Relative `og:image`.** Social scrapers do not resolve relative URLs.
- **Static `public/robots.txt` plus an endpoint.** Two sources conflict; keep one.
- **Indexing SSR search/filter pages.** Add `noindex` or canonicalize to the base list.

## Output

Return a per-page table (route, title length, description length, canonical,
OG image, JSON-LD types, issues), the applied diff, and the verification
commands (`astro build` plus the `dist/` greps). Close with at most three next steps.
