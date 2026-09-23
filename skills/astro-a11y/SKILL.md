---
name: astro-a11y
description: "WCAG 2.2 AA accessibility for Astro projects. Audits layout landmarks, skip links, heading order, focus visibility, keyboard support, native interactive primitives (<dialog>, <details name>, popover), form labels and errors, token-based color contrast and reduced motion, then verifies with axe and Playwright. Triggers on: Astro accessibility, a11y, WCAG, screen reader, keyboard navigation, focus, skip link, aria, color contrast, axe, reduced motion."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: quality
  command: "/astro a11y [path]"
  tagline: "WCAG 2.2 AA with native HTML primitives first, verified by axe and keyboard tests."
  order: 13
---

# Astro Accessibility

Astro renders real HTML, which is the best possible starting point for
accessibility. Most failures come from replacing native elements with `div`s and
JavaScript, or from layouts missing landmarks. This skill fixes structure first,
then interaction, then visuals, and verifies with automated and keyboard tests.

## When to use

- Lighthouse accessibility < 100, axe violations, or an accessibility complaint.
- Scanner findings `a11y.positive-tabindex`, `a11y.click-on-div`,
  `images.img-missing-alt`.
- Building menus, modals, tabs, accordions, tooltips or forms.

## Workflow

1. **Scan.** Run `node "${CLAUDE_PLUGIN_ROOT}/skills/astro/scripts/astro-scan.mjs" <path> --json`
   and read the `a11y.*` and `images.img-missing-alt` findings. Then grep for what
   static analysis misses: `rg -n "onclick|role=\"button\"|tabindex|outline: ?none|aria-" src`.
2. **Layout landmarks.** Each layout has `<html lang>`, one `<header>`, `<nav>`
   with an accessible name, one `<main id="main">`, `<footer>`. A skip link is the
   first focusable element. `lang` follows the current locale in i18n sites.
3. **Headings.** One `<h1>` per page, no skipped levels. Components accept a
   heading level prop instead of hardcoding `<h2>`.
4. **Native primitives before ARIA.** Replace custom widgets:
   | Widget | Native primitive |
   |--------|------------------|
   | Modal | `<dialog>` + `showModal()` (focus trap, Esc, inert background built in) |
   | Accordion | `<details name="group">` (exclusive groups) |
   | Menu / popover | `popover` attribute + `popovertarget` button |
   | Clickable `div` | `<button type="button">` or `<a href>` |
   | Tooltip | Visible text or `aria-describedby`; never hover-only content |
5. **Focus.** Never remove outlines without a replacement; style `:focus-visible`
   with a token color at >= 3:1 contrast. No positive `tabindex`. After client-side
   navigation (`<ClientRouter />`), confirm focus and route announcements work.
6. **Forms.** Every control has a `<label for>`; group radios with `<fieldset>`
   and `<legend>`; errors are linked with `aria-describedby`, marked
   `aria-invalid="true"`, and summarized on submit. Use correct `type` and
   `autocomplete`. See `astro-actions` for server validation.
7. **Contrast.** Check text/background token pairs in both light and dark themes
   (4.5:1 body, 3:1 large text and UI). Fix the token, not each component.
8. **Motion.** Wrap animations and view transitions in
   `@media (prefers-reduced-motion: no-preference)` or disable under `reduce`.
9. **Media.** Informative images have meaningful `alt`; decorative get `alt=""`;
   SVG icons in buttons are `aria-hidden="true"` with a text label on the button.
   Video has captions.
10. **Verify.** Run axe via Playwright on key routes, tab through each page
    (visible focus, logical order, no traps), and test one flow with a screen reader.

## Patterns

```astro
---
// src/layouts/BaseLayout.astro
interface Props { title: string; lang?: string }
const { title, lang = 'en' } = Astro.props;
---
<html lang={lang}>
  <head><meta charset="utf-8" /><title>{title}</title></head>
  <body>
    <a href="#main" class="skip-link">Skip to content</a>
    <header><nav aria-label="Primary"><slot name="nav" /></nav></header>
    <main id="main" tabindex="-1"><slot /></main>
    <footer><slot name="footer" /></footer>
  </body>
</html>
```

```astro
<!-- Accessible modal with no framework -->
<button type="button" data-open="signup">Sign up</button>
<dialog id="signup" aria-labelledby="signup-title">
  <h2 id="signup-title">Create an account</h2>
  <form method="dialog"><button>Close</button></form>
</dialog>
<script>
  document.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelector<HTMLDialogElement>(`#${btn.dataset.open}`)?.showModal();
    });
  });
</script>

<!-- Exclusive accordion and popover menu -->
<details name="faq"><summary>Shipping</summary><p>…</p></details>
<details name="faq"><summary>Returns</summary><p>…</p></details>
<button popovertarget="account-menu">Account</button>
<div id="account-menu" popover><a href="/settings">Settings</a></div>
```

```css
.skip-link { position: absolute; transform: translateY(-120%); }
.skip-link:focus { transform: none; }
:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, ::view-transition-group(*) { animation-duration: 0.01ms !important; transition: none !important; }
}
```

```ts
// tests/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const route of ['/', '/blog/', '/contact/']) {
  test(`no axe violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}
```

## Checklist

- [ ] `<html lang>` set (and locale-aware); one `<main>`; labelled `<nav>`s.
- [ ] Skip link is the first focusable element and becomes visible on focus.
- [ ] One `<h1>`; heading levels never skip.
- [ ] Interactive elements are `<button>`/`<a>`/native controls; no clickable `div`s.
- [ ] Modals use `<dialog>`, accordions `<details>`, menus `popover`.
- [ ] Visible `:focus-visible` style everywhere; no positive `tabindex`.
- [ ] Every form control labelled; errors linked and announced.
- [ ] Token pairs meet 4.5:1 / 3:1 in every theme.
- [ ] Motion respects `prefers-reduced-motion`.
- [ ] axe clean on key routes; keyboard walkthrough done.

## Common mistakes

- **ARIA on top of the wrong element.** `role="button"` on a `div` still lacks
  keyboard activation; use `<button>`.
- **`outline: none` in a reset.** Removes focus for every keyboard user.
- **Placeholder as label.** Disappears on input and fails contrast.
- **Hydrating a framework dialog** when `<dialog>` does it natively with zero JS.
- **Icon-only buttons** without an accessible name.
- **Trusting axe alone.** Automated tools catch roughly a third of issues; keyboard
  and screen reader checks are required.

## Output

Return findings grouped by WCAG success criterion (file:line, criterion, impact,
fix, verify), the applied diff, the axe results before/after, and notes from the
keyboard walkthrough. Close with at most three next steps.
