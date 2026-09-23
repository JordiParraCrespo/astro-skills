---
name: astro-islands
description: "Audit and fix hydration in Astro projects. Picks the right client:* directive, removes unnecessary islands, replaces framework components with native HTML or a vanilla <script>, sets up server islands with server:defer, checks prop serialization, shares state between islands with nanostores and enforces a JS budget. Triggers on: Astro islands, client:load, client:idle, client:visible, client:media, client:only, server:defer, server islands, hydration, partial hydration, nanostores, JS budget, too much JavaScript Astro."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: performance
  command: "/astro islands [path]"
  tagline: "Justifies every client:* directive, defers personalized HTML to server islands and keeps the JS budget honest."
  order: 6
---

# Astro Islands

Astro ships zero JavaScript unless a component opts in with a `client:*` directive.
Every directive is a cost: a framework runtime, a component bundle and hydration
work on the main thread. This skill makes each island earn its place, picks the
latest directive that still feels instant, and moves per-request HTML into server
islands instead of client fetches.

## When to use

- The scanner reports `islands.client-load` or `deps.multiple-frameworks`.
- Lighthouse flags "Reduce unused JavaScript", long tasks or a poor INP / TBT.
- Adding an interactive widget, or a personalized fragment (cart count, avatar,
  "recommended for you") to an otherwise static page.
- Two islands need to share state.

## Workflow

1. **Inventory.** Run the scanner (see the `astro` skill) and read the
   `islands.*` and `deps.*` findings, then list every directive:
   `rg -n "client:(load|idle|visible|media|only)|server:defer" src`.
2. **Ask "does this need JS at all?"** for each island, in this order:
   | Need | Use instead of an island |
   |------|--------------------------|
   | Disclosure / accordion | `<details>` / `<details name="group">` |
   | Modal | `<dialog>` + a 3-line `<script>` calling `showModal()` |
   | Menu, popover, tooltip | Popover API (`popover`, `popovertarget`) + CSS |
   | Tabs, copy button, toggles | A vanilla `<script>` or a custom element |
   | Rich stateful UI (editor, chart, complex form) | A framework island |
3. **Pick the directive** for islands that stay:
   | Directive | Hydrates | Use for |
   |-----------|----------|---------|
   | `client:load` | Immediately on page load | Above-the-fold UI the user touches in the first second |
   | `client:idle` | On `requestIdleCallback` (optional `{{ timeout: ms }}`) | Visible but non-urgent UI |
   | `client:visible` | When scrolled into view (optional `{{ rootMargin: '200px' }}`) | Anything below the fold — the default choice |
   | `client:media="(query)"` | When a media query matches | Mobile-only nav, desktop-only sidebars |
   | `client:only="react"` | Client-only render, no SSR HTML | Components that touch `window` at render time; give them a sized placeholder |
   Default to `client:visible`; `client:load` needs a written reason.
4. **Move per-request HTML to server islands.** A fragment that depends on
   cookies, the user or live data gets `server:defer` so the page itself can stay
   static and cacheable. Server islands need an adapter (on-demand rendering) and
   should always render a `slot="fallback"` with the same dimensions.
5. **Check props.** Island props are serialized into the HTML. Pass only what the
   component needs; no functions, class instances or whole CMS payloads.
6. **Share state without a parent.** Islands do not share a React/Vue tree. Use a
   framework-agnostic store (`nanostores` + `@nanostores/react|vue|…`) or
   `CustomEvent`s on `window`.
7. **Budget.** Count shipped JS: `astro build` then inspect `dist/_astro/*.js`
   sizes per page. A marketing page should ship < 50 KB of JS (gzip); a static
   content page should ship ~0.
8. **Verify.** `astro check && astro build`; view page source to confirm the
   `<astro-island>` elements and their `client` attribute; re-run Lighthouse and
   compare TBT / INP.

## Patterns

```astro
---
import Newsletter from '../components/Newsletter.tsx';
import Comments from '../components/Comments.tsx';
import MobileNav from '../components/MobileNav.tsx';
---
<!-- below the fold: hydrate on scroll, start loading slightly early -->
<Comments client:visible={{ rootMargin: '300px' }} postId={post.id} />
<!-- visible but non-urgent -->
<Newsletter client:idle={{ timeout: 2000 }} />
<!-- only phones need the interactive menu -->
<MobileNav client:media="(max-width: 768px)" links={links} />
```

```astro
---
// Server island: the page stays static; the avatar renders per request.
import UserMenu from '../components/UserMenu.astro';
---
<UserMenu server:defer>
  <a slot="fallback" href="/login" class="size-8 rounded-full">Sign in</a>
</UserMenu>
```

```astro
---
// src/components/UserMenu.astro — runs on demand, can read cookies
const session = Astro.cookies.get('session')?.value;
const user = session ? await getUser(session) : null;
---
{user ? <img src={user.avatar} alt="" width="32" height="32" /> : <a href="/login">Sign in</a>}
```

```ts
// src/stores/cart.ts — shared by any number of islands, any framework
import { atom } from 'nanostores';
export const cartCount = atom(0);
```

```tsx
// src/components/CartBadge.tsx
import { useStore } from '@nanostores/react';
import { cartCount } from '../stores/cart';
export function CartBadge() {
  return <span>{useStore(cartCount)}</span>;
}
```

```astro
<!-- Often better than an island: a custom element, zero framework runtime -->
<copy-button data-text={code}><button type="button">Copy</button></copy-button>
<script>
  class CopyButton extends HTMLElement {
    connectedCallback() {
      this.querySelector('button')?.addEventListener('click', () =>
        navigator.clipboard.writeText(this.dataset.text ?? ''));
    }
  }
  customElements.define('copy-button', CopyButton);
</script>
```

**Prop serialization.** Supported: primitives, plain objects, arrays, `Date`,
`Map`, `Set`, `RegExp`, `URL`, `BigInt`, `Infinity`, typed arrays. Not supported:
functions, class instances, symbols. Children passed through slots are rendered
to static HTML on the server — they are not hydrated. Server island props are
encrypted into the URL; keep them small, and set a stable `ASTRO_KEY`
(`astro create-key`) when running multiple server instances.

> Directive options (`client:idle={{ timeout }}`, `client:visible={{ rootMargin }}`)
> and server islands exist in Astro 5+. Confirm the installed major in
> `package.json` and check `https://docs.astro.build/llms.txt` before relying on them.

## Checklist

- [ ] Every `client:*` has a reason; nothing that native HTML can do is an island.
- [ ] `client:load` only on above-the-fold, immediately-interactive UI.
- [ ] Below-the-fold islands use `client:visible`.
- [ ] `client:only` components render a sized placeholder (no CLS).
- [ ] One UI framework per project unless there is a migration in progress.
- [ ] Per-user fragments use `server:defer` with a same-size `slot="fallback"`.
- [ ] Server islands have an adapter configured; `ASTRO_KEY` set for multi-instance deploys.
- [ ] Island props are minimal and serializable.
- [ ] Cross-island state goes through a store or DOM events, not prop drilling.
- [ ] Per-page JS stays within the agreed budget.

## Common mistakes

- **`client:load` everywhere.** It is the most expensive directive and the
  scanner flags it (`islands.client-load`). Most islands can be `visible` or `idle`.
- **Wrapping a static component in a framework.** A React card with no state ships
  React for nothing — rewrite it as `.astro`.
- **Hydrating a layout wrapper.** Putting `client:load` on a parent that receives the
  page as children does not hydrate the children and still ships the parent's JS.
- **Mixing frameworks casually** (`deps.multiple-frameworks`): each one adds its
  runtime to every page that uses it.
- **Fetching personalized data client-side** on a static page when a server island
  would stream the HTML with no client JS.
- **Passing a whole CMS entry as a prop.** It is serialized into the HTML and
  inflates the document.

## Output

Return a table of islands (file:line, component, current directive, recommended
directive or native replacement, estimated JS saved), the applied diff, and the
per-page JS totals before and after from `dist/_astro/`.
