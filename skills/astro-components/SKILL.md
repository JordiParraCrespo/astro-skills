---
name: astro-components
description: "Design and review .astro components (v5+): typed Props interfaces, HTMLAttributes pass-through, named slots and Astro.slots, class merging with class:list, polymorphic elements, bundled <script> vs is:inline, custom elements for interactivity, and one-concept-per-file conventions. Triggers on: Astro component, .astro file, Astro.props, Props interface, Astro slots, named slot, Astro.slots.has, class:list, astro component architecture, reusable Astro component."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: foundations
  command: "/astro components [path]"
  tagline: "Typed props, composable slots and zero-JS components that stay small, owned and easy to change."
  order: 3
---

# Astro Components

`.astro` components render to HTML at build (or request) time and ship no
JavaScript unless they include a `<script>` or hydrate an island. Good components are
typed at the boundary, compose through slots, and keep interactivity in the platform.

## When to use

- Creating a new component, layout or design-system primitive.
- Reviewing components for untyped props, prop drilling, or needless islands.
- Converting a React/Vue/Svelte component that has no real client state into `.astro`.

## Workflow

1. **Inventory.** Run the scanner (see the `astro` skill) and read
   `islands.client-load`, `a11y.click-on-div`, `styles.raw-color` and
   `deps.multiple-frameworks`. Then list components:
   `rg --files src | rg '\.(astro|tsx|jsx|vue|svelte)$'`.
2. **Decide the kind** for each component:

   | Needs | Use |
   |-------|-----|
   | Markup only | `.astro`, no script |
   | Small DOM behaviour (toggle, copy, tabs) | `.astro` + bundled `<script>` / custom element |
   | Open/close, disclosure, menu | Native `<dialog>`, `<details name>`, `popover` attribute |
   | Rich client state shared across a tree | A framework island (see `astro-islands`) |
3. **Type the boundary.** Every component declares `interface Props`. Extend
   `HTMLAttributes<'tag'>` from `astro/types` when it wraps a native element, and
   spread the rest so `id`, `aria-*` and `data-*` pass through.
4. **Compose with slots**, not boolean props. Use named slots for regions
   (`header`, `footer`, `actions`) and `Astro.slots.has()` to omit empty wrappers.
5. **One concept per file.** Compound families (`card/Card.astro`,
   `card/CardHeader.astro`, …) live in a folder; prefer named imports via a path
   alias (`@/components/...`) over deep relative paths.
6. **Scripts.** A plain `<script>` is processed, bundled and de-duplicated — use it
   by default. `is:inline` only for code that must run before paint (theme flash)
   or third-party snippets; it is shipped per instance and not bundled.
7. **Verify.** `astro check` (props errors surface here), `astro build`, then
   confirm the route ships no unexpected JS: `ls dist/_astro/*.js`.

## Patterns

Typed wrapper with attribute pass-through and class merging:

```astro
---
// src/components/Button.astro
import type { HTMLAttributes } from 'astro/types';

type Props = HTMLAttributes<'button'> & {
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md';
};

const { variant = 'primary', size = 'md', class: className, type = 'button', ...rest } = Astro.props;
---
<button
  type={type}
  class:list={[
    'inline-flex items-center rounded-md font-medium focus-visible:outline-2',
    { 'bg-primary text-primary-fg': variant === 'primary', 'bg-transparent': variant === 'ghost' },
    size === 'sm' ? 'px-3 py-1 text-sm' : 'px-4 py-2',
    className,
  ]}
  {...rest}
>
  <slot />
</button>
```

Polymorphic element (link or button, same styles):

```astro
---
import type { HTMLTag, Polymorphic } from 'astro/types';
type Props<Tag extends HTMLTag = 'a'> = Polymorphic<{ as: Tag }>;
const { as: Tag = 'a', ...rest } = Astro.props;
---
<Tag {...rest}><slot /></Tag>
```

Named slots, conditional wrappers and slot forwarding:

```astro
---
// src/components/Card.astro
interface Props { as?: 'article' | 'section' | 'div' }
const { as: Tag = 'article' } = Astro.props;
---
<Tag class="rounded-lg border border-border bg-surface p-6">
  {Astro.slots.has('header') && <header class="mb-4"><slot name="header" /></header>}
  <slot />
  {Astro.slots.has('footer') && <footer class="mt-4"><slot name="footer" /></footer>}
</Tag>
```

```astro
<Card>
  <h2 slot="header">Plans</h2>
  <p>Body content goes to the default slot.</p>
  <Fragment slot="footer"><a href="/pricing">Compare plans</a></Fragment>
</Card>
```

Interactive behaviour without a framework (custom element + bundled script):

```astro
<copy-button data-text={code}>
  <button type="button">Copy</button>
</copy-button>

<script>
  class CopyButton extends HTMLElement {
    connectedCallback() {
      this.querySelector('button')?.addEventListener('click', () => {
        navigator.clipboard.writeText(this.dataset.text ?? '');
      });
    }
  }
  if (!customElements.get('copy-button')) customElements.define('copy-button', CopyButton);
</script>
```

Custom elements re-initialise themselves on every insertion, so they keep working
with `<ClientRouter />` page swaps (see `astro-transitions`).

## Checklist

- [ ] Every component has `interface Props` / `type Props`; no `any`.
- [ ] Native-element wrappers extend `HTMLAttributes<'tag'>` and spread `...rest`.
- [ ] `class` is accepted and merged via `class:list`, not overwritten.
- [ ] Regions use named slots; empty wrappers are guarded with `Astro.slots.has()`.
- [ ] Clickable things are `<button>` or `<a href>`, never `<div onclick>`.
- [ ] Disclosure/dialog/menus use `<details>`, `<dialog>` or `popover` before JS.
- [ ] `<script>` is bundled by default; `is:inline` is justified in a comment.
- [ ] No framework island where an `.astro` component + script would do.
- [ ] Imports use a path alias; no `../../../` chains.
- [ ] Styles use design tokens (see `astro-styling`), no raw colors.

## Common mistakes

- **Destructuring `class` directly.** `class` is a reserved word; rename it:
  `const { class: className } = Astro.props`.
- **Expecting reactivity.** Frontmatter runs once per render on the server; changing
  a variable in a `<script>` does not re-render the component.
- **Passing functions to `.astro` children expecting client callbacks.** Props are
  serialized at render time; event handlers belong in `<script>` or an island.
- **`set:html` on untrusted strings.** It bypasses escaping (scanner rule
  `security.set-html`); sanitize or render Markdown through content collections.
- **Wrapping every component in a framework "just in case".** Each island costs
  runtime JS and a hydration step.
- **`Astro.glob()` to list components or posts.** Removed; use `import.meta.glob`
  or content collections.

## Output

Return a table (component, kind, issues, fix), the applied diffs, and the
`astro check` + `astro build` output. List any component that should become or stop
being an island, with the JS bytes it adds or saves.
