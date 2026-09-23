---
name: astro-actions
description: "Build and audit Astro Actions: type-safe server functions with Zod-validated input. Covers defineAction, accept:'form' with progressive-enhancement form posts, calling actions from client scripts, Astro.getActionResult, isInputError field errors, ActionError codes, on-demand rendering requirements and security (validation, rate limiting, checkOrigin CSRF protection, honeypots, secrets via astro:env). Triggers on: Astro Actions, defineAction, astro:actions, ActionError, isInputError, getActionResult, Astro form, contact form Astro, newsletter form, form validation Astro, server function."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: content
  command: "/astro actions [path]"
  tagline: "Zod-validated Astro Actions with forms that work without JS and fail safely under abuse."
  order: 14
---

# Astro Actions

Actions are typed server functions defined in `src/actions/` and called from forms
or client scripts through `astro:actions`. Input is validated by a Zod schema before
the handler runs, and errors come back as structured values. This skill builds
forms that post without JavaScript, enhance with it, and stay safe in production.

## When to use

- Adding a contact, newsletter, feedback, comment or login form.
- Replacing hand-written `src/pages/api/*.ts` POST endpoints that parse `FormData`
  by hand.
- Auditing existing actions for validation, error handling and abuse controls.
- A form "works in dev but not in production" (usually a prerendered page or no adapter).

## Workflow

1. **Inventory.** Run the scanner (see the `astro` skill) and read `config.*`,
   `env.*` and `security.*`. Then list actions and call sites:
   `rg -n "defineAction|actions\.|getActionResult|isInputError" src`.
2. **Check the runtime.** Actions run on the server: the project needs an adapter,
   and any page that *receives* a form POST must be on-demand
   (`export const prerender = false`). Other pages can stay static and call
   actions from client scripts.
3. **Define the action** in `src/actions/index.ts` (`export const server = { … }`),
   one per use case, with `accept: 'form'` for HTML forms and a strict `input`
   schema: trimmed strings, `max()` lengths, `email()`, enums, coerced numbers.
4. **Build the form to work without JS.** `<form method="POST" action={actions.x}>`
   with real `name` attributes, `<label>`s, native `required`/`type` validation,
   then read `Astro.getActionResult(actions.x)` to render success or field errors.
5. **Enhance (optional).** A small `<script>` intercepts `submit`, calls
   `actions.x(new FormData(form))`, and updates the DOM — no framework needed.
6. **Handle errors.** `isInputError(error)` → show `error.fields[name]` next to each
   field; otherwise show a generic message. Throw `ActionError` with a precise
   `code` from the handler; never leak stack traces or provider errors.
7. **Harden.** Keep `security.checkOrigin` enabled (default `true`) for CSRF
   protection; add a honeypot field; rate-limit by `context.clientAddress` or
   session; read secrets from `astro:env/server`; cap payload sizes in the schema.
8. **Verify.** `astro check && astro build`; submit with JS disabled and enabled;
   submit invalid data and confirm field errors; submit from another origin
   (`curl -X POST -H 'Origin: https://evil.example'`) and confirm a 403.

## Patterns

```ts
// src/actions/index.ts
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod'; // older majors: 'astro:schema'
import { RESEND_API_KEY } from 'astro:env/server';

export const server = {
  contact: defineAction({
    accept: 'form',
    input: z.object({
      name: z.string().trim().min(1).max(100),
      email: z.string().trim().email().max(254),
      message: z.string().trim().min(10).max(5000),
      website: z.string().max(0).optional(), // honeypot: humans leave it empty
    }),
    handler: async (input, context) => {
      if (await isRateLimited(context.clientAddress)) {
        throw new ActionError({ code: 'TOO_MANY_REQUESTS', message: 'Try again in a minute.' });
      }
      const ok = await sendEmail(RESEND_API_KEY, input);
      if (!ok) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not send.' });
      return { sent: true };
    },
  }),
};
```

```astro
---
// src/pages/contact.astro — works with JavaScript disabled
export const prerender = false;
import { actions, isInputError } from 'astro:actions';

const result = Astro.getActionResult(actions.contact);
const fieldErrors = result?.error && isInputError(result.error) ? result.error.fields : {};
---
{result?.data?.sent && <p role="status">Thanks, we'll reply soon.</p>}
{result?.error && !isInputError(result.error) && <p role="alert">{result.error.message}</p>}

<form id="contact-form" method="POST" action={actions.contact}>
  <label for="name">Name</label>
  <input id="name" name="name" required maxlength="100" aria-describedby="name-err" />
  {fieldErrors.name && <p id="name-err">{fieldErrors.name.join(', ')}</p>}

  <label for="email">Email</label>
  <input id="email" name="email" type="email" required aria-describedby="email-err" />
  {fieldErrors.email && <p id="email-err">{fieldErrors.email.join(', ')}</p>}

  <label for="message">Message</label>
  <textarea id="message" name="message" required minlength="10"></textarea>

  <div hidden><label>Leave empty <input name="website" tabindex="-1" autocomplete="off" /></label></div>
  <button type="submit">Send</button>
</form>
```

```astro
<script>
  // Progressive enhancement: same action, no page reload
  import { actions, isInputError } from 'astro:actions';
  const form = document.querySelector<HTMLFormElement>('#contact-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data, error } = await actions.contact(new FormData(form));
    if (error) {
      if (isInputError(error)) console.warn(error.fields); // render inline errors
      return;
    }
    if (data.sent) form.replaceWith(Object.assign(document.createElement('p'),
      { role: 'status', textContent: 'Thanks, we will reply soon.' }));
  });
</script>
```

**ActionError codes** map to HTTP statuses: `BAD_REQUEST`, `UNAUTHORIZED`,
`FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`,
`TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`, and others. Use `actions.x.orThrow()`
when you want exceptions instead of `{ data, error }`.

**Reloads and resubmits.** A plain form POST re-renders the page with the result;
refreshing resubmits. For a POST/Redirect/GET flow, use `getActionContext()` in
middleware to run the action, store the result (session or cookie) and redirect.

> The Zod import path, `getActionContext`, sessions and default body-size limits
> vary by major. Check the installed version in `package.json` and
> `https://docs.astro.build/llms.txt`, and match the project's existing imports.

## Checklist

- [ ] An adapter is installed; pages receiving form POSTs set `prerender = false`.
- [ ] Every action has a strict `input` schema with length caps.
- [ ] Forms work with JavaScript disabled (`method="POST" action={actions.x}`).
- [ ] Field errors come from `isInputError(error).fields`, tied to inputs via `aria-describedby`.
- [ ] Success and error messages use `role="status"` / `role="alert"`.
- [ ] Handlers throw `ActionError` with specific codes; no raw error messages leak.
- [ ] `security.checkOrigin` is not disabled.
- [ ] Rate limiting and a honeypot (or captcha) protect public forms.
- [ ] Secrets come from `astro:env/server`, never `import.meta.env.PUBLIC_*` or `process.env` (`env.process-env`).
- [ ] Authorization is checked inside the handler, not only in the UI.

## Common mistakes

- **Posting to a prerendered page.** The static HTML cannot run the action;
  the form 404s or 405s in production.
- **Trusting client-side validation.** The schema is the only real validation.
- **Returning secrets or internals** in `data` — everything returned is sent to the
  browser.
- **Disabling `checkOrigin`** to "fix" a proxy issue instead of configuring the
  proxy's forwarded headers.
- **In-memory rate limits on serverless.** Each instance has its own memory; use a
  shared store (KV, Redis, database).
- **A framework island just for a form.** A native form plus a small script is enough.

## Output

Return a table of actions (name, accept, schema strictness, auth, rate limit,
no-JS support, issues), the applied diff, and the verification results for the
JS-off, invalid-input and cross-origin submissions.
