---
name: astro-transitions
description: "Add and audit view transitions in Astro projects. Chooses between zero-JS native cross-document @view-transition CSS and the <ClientRouter /> from astro:transitions, applies transition:name, transition:animate and transition:persist, fixes scripts that stop working after navigation with astro:page-load and astro:after-swap, configures prefetch and data-astro-reload, and respects prefers-reduced-motion. Triggers on: Astro view transitions, ClientRouter, ViewTransitions, astro:transitions, transition:name, transition:persist, astro:page-load, astro:after-swap, prefetch Astro, page transitions, SPA navigation Astro, scripts not running after navigation."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: performance
  command: "/astro transitions [path]"
  tagline: "Smooth navigations with native CSS first, <ClientRouter /> when needed, and scripts that survive the swap."
  order: 11
---

# Astro Transitions

Astro supports two ways to animate between pages: the browser's native
cross-document view transitions (pure CSS, zero JavaScript, multi-page app) and
`<ClientRouter />` from `astro:transitions` (a small client router that swaps pages
in place, enabling persistent state and lifecycle events). This skill picks the
cheaper one that meets the need, wires it correctly and fixes the script bugs a
client router introduces.

## When to use

- The scanner reports `api.view-transitions-renamed` (`<ViewTransitions />` is now
  `<ClientRouter />`).
- Adding animated page transitions, shared-element morphs or a persistent media player.
- "My script / menu / analytics stops working after clicking a link."
- Tuning link prefetching.

## Workflow

1. **Inventory.** Run the scanner (see the `astro` skill) and read
   `api.view-transitions-renamed`. Then:
   `rg -n "ClientRouter|ViewTransitions|transition:|astro:page-load|astro:after-swap|@view-transition|prefetch" src astro.config.*`.
2. **Choose the mechanism:**
   | Need | Use |
   |------|-----|
   | Fade/slide between pages, shared-element morphs | Native `@view-transition { navigation: auto; }` — zero JS |
   | State that must survive navigation (audio/video player, island state) | `<ClientRouter />` + `transition:persist` |
   | Lifecycle hooks, programmatic `navigate()`, custom swap | `<ClientRouter />` |
   Browsers without cross-document support simply navigate normally — that is an
   acceptable fallback. Prefer native unless one of the router rows applies.
3. **Wire it.** Native: one CSS rule in the global stylesheet plus
   `view-transition-name` on shared elements. Router: `<ClientRouter />` in the
   `<head>` of the shared layout (every page that should transition must include it).
4. **Name shared elements.** `transition:name` (router) or `view-transition-name`
   (native) must be unique on each page; derive it from the entry id.
5. **Fix scripts (router only).** Bundled `<script>`s run once per full load, not
   per navigation. Move DOM setup into an `astro:page-load` listener; use
   `astro:after-swap` for work that must happen before paint (e.g. theme class).
   Inline scripts that must re-run get `data-astro-rerun`.
6. **Opt out where needed.** `data-astro-reload` on links that must do a full load
   (downloads, pages with incompatible scripts, other apps on the same origin).
7. **Prefetch.** Configure `prefetch` in `astro.config` (the router enables it by
   default); use `data-astro-prefetch` per link. Prefer `hover`/`tap` over
   `viewport`/`load` on link-heavy pages to save bandwidth.
8. **Reduced motion.** The router disables its animations under
   `prefers-reduced-motion: reduce`; native transitions need an explicit media query.
9. **Verify.** `astro check && astro build`; navigate with DevTools open and
   confirm no duplicate listeners or console errors; toggle reduced motion in
   DevTools rendering settings; test the back button and a full reload on every
   transitioned route.

## Patterns

```css
/* Native cross-document transitions: zero JS, global stylesheet */
@view-transition {
  navigation: auto;
}
@media (prefers-reduced-motion: reduce) {
  @view-transition {
    navigation: none;
  }
}
```

```astro
<!-- native shared element: same name on the list card and the detail hero -->
<img src={cover.src} alt="" style={`view-transition-name: cover-${post.id}`} />
```

```astro
---
// src/layouts/Base.astro — client router variant
import { ClientRouter } from 'astro:transitions';
---
<html lang="en">
  <head>
    <ClientRouter />
  </head>
  <body>
    <header transition:animate="none">…</header>
    <main transition:animate="fade"><slot /></main>
    <audio-player transition:persist="player"></audio-player>
  </body>
</html>
```

```astro
<h1 transition:name={`title-${post.id}`}>{post.data.title}</h1>
<Counter client:visible transition:persist transition:persist-props />
<a href="/export.csv" data-astro-reload>Download CSV</a>
<a href="/pricing" data-astro-prefetch="viewport">Pricing</a>
```

```astro
<script>
  // Runs on first load and after every client-side navigation.
  function initMenu() {
    const button = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
    button?.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
    });
  }
  document.addEventListener('astro:page-load', initMenu);

  // Runs after the new DOM is swapped in, before it is painted.
  document.addEventListener('astro:after-swap', () => {
    const theme = localStorage.getItem('theme');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  });
</script>
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});
```

Full router event order: `astro:before-preparation` → `astro:after-preparation` →
`astro:before-swap` → `astro:after-swap` → `astro:page-load`. Use `before-swap`
(`event.swap` / `event.newDocument`) to customize what is replaced. Programmatic
navigation: `import { navigate } from 'astro:transitions/client'`.

> `<ViewTransitions />` was renamed to `<ClientRouter />` in Astro 5 and the old
> name is removed in later majors. Built-in animation names, `fallback` options and
> prefetch defaults can change between majors; check the installed version in
> `package.json` and `https://docs.astro.build/llms.txt`.

## Checklist

- [ ] No `<ViewTransitions />` imports remain.
- [ ] Native `@view-transition` chosen unless persistence or lifecycle hooks are required.
- [ ] `<ClientRouter />` (if used) is in the shared layout `<head>` of every transitioned page.
- [ ] `transition:name` / `view-transition-name` values are unique per page.
- [ ] DOM setup runs on `astro:page-load`; pre-paint work (theme) on `astro:after-swap`.
- [ ] No listeners added to `document`/`window` on every navigation without cleanup.
- [ ] Analytics fire a page view per client-side navigation (router only).
- [ ] Focus and announcements are sane after navigation (router moves focus; check custom swaps).
- [ ] `prefers-reduced-motion` disables or shortens animations.
- [ ] Prefetch strategy is deliberate; `data-astro-reload` on links that must fully load.

## Common mistakes

- **Adding the router for a simple fade.** Native CSS does it with zero JS.
- **`DOMContentLoaded` with the router.** It fires once; menus break after the
  first navigation. Use `astro:page-load`.
- **Duplicate `transition:name`** on one page (e.g. a list with the same name on
  every card) aborts the transition.
- **Misusing `transition:persist-props`.** A persisted island re-renders with the
  new page's props by default; add `transition:persist-props` only when it must
  keep its old props.
- **Theme flash after swap** because the class is set on `page-load` instead of
  `after-swap`.
- **Prefetching everything on `load`** on pages with hundreds of links.

## Output

Return the mechanism chosen and why, a table of issues (file:line, problem, fix),
the applied diff, and the manual verification steps performed (navigation, back
button, reduced motion, JS console).
