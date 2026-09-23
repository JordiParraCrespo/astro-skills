---
name: astro-styling
description: "Style Astro projects (v5+) with Tailwind v4 and design tokens: @import 'tailwindcss' via @tailwindcss/vite, @theme tokens backed by CSS variables, scoped <style> vs utilities, :global and is:global, class:list, define:vars, flash-free dark mode with an inline script, and no raw colors in components. Triggers on: Astro Tailwind, Tailwind v4 Astro, @tailwindcss/vite, @theme, design tokens Astro, Astro dark mode, class:list, define:vars, scoped styles Astro, Astro CSS, is:global."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: foundations
  command: "/astro styling [path]"
  tagline: "Tailwind v4 on design tokens, scoped styles only where utilities can't reach, and dark mode without the flash."
  order: 5
---

# Astro Styling

Astro compiles styles at build time: scoped `<style>` blocks, global CSS and
Tailwind all end up as static CSS with no runtime. The goal is one source of truth
for color, spacing and type (tokens), utilities for everything they can express,
and scoped CSS only for what they cannot.

## When to use

- Setting up or migrating to Tailwind v4 (from `@astrojs/tailwind` / Tailwind v3).
- Introducing design tokens or a theme, or adding dark mode.
- Reviewing components for raw colors, duplicated styles or theme flashes.

## Workflow

1. **Inventory.** Run the scanner (see the `astro` skill) and read
   `styles.raw-color` findings. Then check the setup:
   `rg -n "tailwind" package.json astro.config.*` and
   `rg -n "#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|(bg|text|border)-(zinc|gray|slate|red|blue)-\d" src/components`.
2. **Tailwind v4 wiring.** `npx astro add tailwind` (recent majors) or install
   `tailwindcss @tailwindcss/vite` and add the Vite plugin. Remove
   `@astrojs/tailwind` and `tailwind.config.*` when migrating from v3; move theme
   values into CSS with `@theme`. Import the global stylesheet once, in the base layout.
3. **Tokens.** Define semantic tokens (`--color-bg`, `--color-fg`, `--color-primary`,
   `--color-border`, …) in `@theme`. Palette values live only there; components
   reference semantic utilities (`bg-bg`, `text-fg`, `border-border`).
4. **Pick the tool per rule:**

   | Need | Use |
   |------|-----|
   | Layout, spacing, color, type, states | Tailwind utilities |
   | Conditional classes | `class:list` |
   | Value computed from props at render | `define:vars` or an inline `style` custom property |
   | Keyframes, complex selectors, MDX/prose content under `<slot />` | Scoped `<style>` (with `:global()` for slotted/rendered HTML) |
   | Resets, base element styles | `@layer base` in `global.css` |

5. **Dark mode.** Tokens switch under a class (or `prefers-color-scheme`). Apply the
   class before first paint with a tiny `is:inline` script in `<head>`.
6. **Verify.** `astro build`; confirm one CSS file (or inline styles) per page in
   `dist`, no unused theme duplication, and no flash: load with the dark preference
   and throttled CPU in DevTools. Re-run the scanner: zero `styles.raw-color`.

## Patterns

```css
/* src/styles/global.css */
@import 'tailwindcss';

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-bg: oklch(99% 0 0);
  --color-fg: oklch(21% 0.006 286);
  --color-muted: oklch(55% 0.014 286);
  --color-surface: oklch(97% 0.001 286);
  --color-border: oklch(92% 0.004 286);
  --color-primary: oklch(55% 0.2 264);
  --color-primary-fg: oklch(99% 0 0);
  --font-sans: ui-sans-serif, system-ui, sans-serif;
  --radius-card: 0.75rem;
}

@layer base {
  .dark {
    --color-bg: oklch(15% 0.005 286);
    --color-fg: oklch(97% 0 0);
    --color-muted: oklch(71% 0.013 286);
    --color-surface: oklch(21% 0.006 286);
    --color-border: oklch(27% 0.006 286);
  }
  body { @apply bg-bg text-fg font-sans antialiased; }
}
```

Every `--color-*` in `@theme` becomes a utility (`bg-primary`, `text-muted`,
`border-border`) and stays a CSS variable, so scoped CSS can use
`var(--color-primary)` too.

Flash-free theme (in the base layout `<head>`, before any stylesheet paints):

```astro
<script is:inline>
  (() => {
    let stored = null;
    try { stored = localStorage.getItem('theme'); } catch {}
    const dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  })();
</script>
```

With `<ClientRouter />`, re-apply it on `astro:after-swap` (see `astro-transitions`).

`class:list`, `define:vars` and a justified scoped block:

```astro
---
interface Props { tone?: 'neutral' | 'primary'; progress: number; class?: string }
const { tone = 'neutral', progress, class: className } = Astro.props;
---
<div class:list={['h-2 rounded-full bg-surface', className]}>
  <div class:list={['bar h-full rounded-full', tone === 'primary' ? 'bg-primary' : 'bg-fg']}></div>
</div>

<style define:vars={{ progress: `${progress}%` }}>
  /* runtime value from props + keyframes: not expressible as a static utility */
  .bar { width: var(--progress); animation: grow 600ms ease-out; }
  @keyframes grow { from { width: 0; } }
</style>
```

Using `@apply` or theme functions inside a component `<style>` needs a reference to
the main stylesheet (Tailwind v4 processes each block separately):

```astro
<style>
  @reference "../styles/global.css";
  .prose :global(a) { @apply text-primary underline; }
</style>
```

Scoping rules: `<style>` is scoped to the component by default; `:global(sel)`
escapes for one selector (needed for `<slot />` content and `set:html` output);
`<style is:global>` makes the whole block global — reserve it for layouts.

## Checklist

- [ ] Tailwind v4 via `@tailwindcss/vite`; no `@astrojs/tailwind`, no `tailwind.config.*` unless using `@config` deliberately.
- [ ] `global.css` starts with `@import 'tailwindcss';` and is imported once in the base layout.
- [ ] Semantic tokens in `@theme`; palette values appear nowhere else.
- [ ] Components use token utilities; no hex/rgb/hsl or raw palette classes (`styles.raw-color`).
- [ ] Conditional classes use `class:list`; components accept and merge `class`.
- [ ] Scoped `<style>` only for what utilities cannot express, with a short reason.
- [ ] Dark mode tokens switch under one class; inline head script prevents the flash.
- [ ] Focus styles visible in both themes (`focus-visible:` utilities).
- [ ] Contrast of fg/bg and primary/primary-fg ≥ 4.5:1 in both themes.

## Common mistakes

- **Mixing Tailwind v3 and v4 setups.** `@tailwind base;` directives and
  `@astrojs/tailwind` do not work with v4; use `@import 'tailwindcss'`.
- **Dynamic class names** like `` `bg-${color}-500` ``. Tailwind scans source text,
  so the class is never generated; map props to complete class strings.
- **Dark mode via a bundled `<script>`.** Bundled scripts are deferred modules and
  run after first paint, so the page flashes. Use `is:inline` in `<head>`.
- **Raw colors in components** (`bg-zinc-900`, `#0a0a0a`). They bypass the theme and
  break dark mode; add a token instead.
- **Styling slotted content from a scoped block** without `:global()`. Scoped
  selectors only match elements in the component's own template.
- **`is:global` in leaf components.** It leaks styles site-wide and defeats scoping.

## Output

Return the setup diff (config, `global.css`), a table of raw-color and scoped-style
findings (file:line, fix), the applied component diffs, and the verification
(`astro build` output, scanner re-run, dark-mode check).
