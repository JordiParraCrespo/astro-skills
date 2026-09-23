---
name: astro-i18n
description: "Set up and audit internationalization in Astro projects with built-in i18n routing. Configures defaultLocale, locales, prefixDefaultLocale and fallback, builds parallel [lang] routes with getStaticPaths, locale-aware links via astro:i18n helpers, translated content collections, UI string dictionaries, hreflang alternates with x-default and an accessible locale switcher. Triggers on: Astro i18n, internationalization, localization, multilingual Astro, getRelativeLocaleUrl, Astro.currentLocale, hreflang, x-default, locale switcher, translations, [lang] routes."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: content
  command: "/astro i18n [path]"
  tagline: "Built-in i18n routing with parallel locale routes, locale-aware links, hreflang and a real switcher."
  order: 8
---

# Astro i18n

Astro's built-in i18n routing maps locales to URL prefixes and exposes helpers in
`astro:i18n` that build correct URLs for any locale. This skill configures it,
makes every internal link locale-aware, keeps translated pages and content in
parallel, and emits the `hreflang` alternates search engines need.

## When to use

- Adding a second language, or auditing an existing multilingual site.
- The scanner reports `links.hardcoded-internal` on a site with `i18n` configured.
- Search Console reports hreflang errors, or the wrong language ranks.
- Pages exist in one locale but 404 in another.

## Workflow

1. **Inventory.** Run the scanner (see the `astro` skill); read `links.*` and
   `seo.*`. Then read the `i18n` block in `astro.config.*` and list routes:
   `rg -n "href=\"/|getRelativeLocaleUrl|currentLocale" src` and
   `find src/pages -name '*.astro' | sort`.
2. **Configure.** Set `i18n.defaultLocale`, `i18n.locales` and
   `routing.prefixDefaultLocale` (`false` keeps the default at `/`, others at
   `/<lang>/`). Add `fallback` only if missing translations should serve the
   default locale instead of 404. `site` must be set for absolute URLs.
3. **Parallel routes.** Every page at `src/pages/foo.astro` gets a twin at
   `src/pages/[lang]/foo.astro` whose `getStaticPaths` emits one entry per
   non-default locale. Share the body in a component so the two files stay tiny.
4. **Links.** Replace every hardcoded internal `href="/…"` with
   `getRelativeLocaleUrl(Astro.currentLocale, '/path')`.
5. **UI strings.** Keep one typed dictionary per locale and a `t(locale)` helper.
   The default-locale dictionary defines the key type; other locales must satisfy it.
6. **Translated content.** Lay collections out as `{locale}/{slug}.md`; filter by
   ``id.startsWith(`${locale}/`)`` and strip the prefix for the URL slug.
7. **hreflang.** In the layout `<head>`, emit one `<link rel="alternate" hreflang>`
   per locale that actually has the page, plus `x-default`, all absolute.
8. **Switcher and `lang`.** Set `<html lang={Astro.currentLocale}>`; add a locale
   switcher that links to the same page in each locale.
9. **Verify.** `astro check && astro build`; confirm `dist/` contains every
   locale's pages, grep built HTML for `hreflang` and for any `href="/` that skips
   the locale prefix.

## Patterns

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example.com',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'de'],
    routing: { prefixDefaultLocale: false },
    fallback: { de: 'en' }, // /de/* pages without a translation serve English
  },
});
```

```astro
---
// src/pages/[lang]/about.astro — parallel route for non-default locales
import About from '../../components/pages/About.astro';

export function getStaticPaths() {
  return ['es', 'de'].map((lang) => ({ params: { lang } }));
}
---
<About />
```

```ts
// src/i18n/ui.ts — typed dictionaries
export const ui = {
  en: { 'nav.home': 'Home', 'nav.blog': 'Blog', 'switcher.label': 'Language' },
  es: { 'nav.home': 'Inicio', 'nav.blog': 'Blog', 'switcher.label': 'Idioma' },
  de: { 'nav.home': 'Startseite', 'nav.blog': 'Blog', 'switcher.label': 'Sprache' },
} as const satisfies Record<string, Record<string, string>>;

export type Locale = keyof typeof ui;
export function t(locale: string | undefined) {
  const dict = ui[(locale ?? 'en') as Locale] ?? ui.en;
  return (key: keyof typeof ui.en) => dict[key] ?? ui.en[key];
}
```

```astro
---
// src/components/Hreflang.astro — rendered in the layout <head>
import { getAbsoluteLocaleUrl } from 'astro:i18n';
interface Props { path: string; locales: string[] } // locales that have this page
const { path, locales } = Astro.props;
---
{locales.map((l) => <link rel="alternate" hreflang={l} href={getAbsoluteLocaleUrl(l, path)} />)}
<link rel="alternate" hreflang="x-default" href={getAbsoluteLocaleUrl('en', path)} />
```

```astro
---
// src/components/LocaleSwitcher.astro
import { getRelativeLocaleUrl } from 'astro:i18n';
import { t } from '../i18n/ui';
interface Props { path: string; locales: string[] }
const { path, locales } = Astro.props;
const names = { en: 'English', es: 'Español', de: 'Deutsch' } as Record<string, string>;
const current = Astro.currentLocale;
---
<nav aria-label={t(current)('switcher.label')}>
  <ul>
    {locales.map((l) => (
      <li>
        <a href={getRelativeLocaleUrl(l, path)} hreflang={l} lang={l}
           aria-current={l === current ? 'page' : undefined}>{names[l] ?? l}</a>
      </li>
    ))}
  </ul>
</nav>
```

Other helpers in `astro:i18n`: `getPathByLocale`, `getLocaleByPath`,
`getRelativeLocaleUrlList`, `getAbsoluteLocaleUrlList`, and middleware utilities.
On on-demand pages, `Astro.preferredLocale` / `Astro.preferredLocaleList` read
`Accept-Language` — use them to *suggest* a locale, never to force a redirect that
crawlers cannot escape.

> Routing options (`redirectToDefaultLocale`, `fallbackType: 'rewrite'`, `domains`,
> `manual` routing) differ between majors. Check the installed version in
> `package.json` and `https://docs.astro.build/llms.txt` before using them.

## Checklist

- [ ] `site`, `i18n.defaultLocale` and `i18n.locales` set; `prefixDefaultLocale` chosen deliberately.
- [ ] Every default-locale page has a `[lang]` twin (or a documented fallback).
- [ ] No hardcoded internal hrefs; all go through `getRelativeLocaleUrl`.
- [ ] `<html lang>` reflects `Astro.currentLocale`.
- [ ] UI strings come from typed dictionaries; no inline English in shared components.
- [ ] Content collections use `{locale}/{slug}` and queries filter by locale.
- [ ] Absolute `hreflang` alternates for each existing translation + `x-default`, reciprocal across locales.
- [ ] Canonical points at the page's own locale URL, not the default locale.
- [ ] Locale switcher links to the same page, labels each language in its own language, marks the current one.
- [ ] Nav hides items with no translation in the current locale (unless a fallback serves them).

## Common mistakes

- **Hardcoded `/about`** in a nav component silently drops users back into the
  default locale (`links.hardcoded-internal`).
- **hreflang to pages that do not exist** in that locale, or missing return links —
  search engines ignore the whole cluster.
- **Canonical to the default locale** on translated pages, which de-indexes them.
- **Auto-redirecting by `Accept-Language`** on every request; bots and users on a
  shared link can never reach the other locale.
- **Flags as language icons.** Languages are not countries; use language names.
- **Forgetting RSS, sitemap and 404** — each needs locale awareness too.

## Output

Return a locale-by-route matrix (route × locale: present / fallback / missing), the
list of hardcoded links fixed, the applied diff, and a sample of the built
`hreflang` block for one page.
