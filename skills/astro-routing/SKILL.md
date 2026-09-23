---
name: astro-routing
description: "File-based routing in Astro (v5+): static and dynamic pages, getStaticPaths with typed params and props, rest params, pagination, API endpoints, on-demand routes with prerender=false, middleware with typed Astro.locals, redirects, rewrites, trailing slashes, custom 404/500 pages and locale-aware internal links. Triggers on: Astro routing, getStaticPaths, dynamic route, [slug].astro, [...slug], Astro endpoint, APIRoute, Astro middleware, Astro.locals, Astro redirects, Astro.rewrite, prerender false, paginate."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: foundations
  command: "/astro routing [path]"
  tagline: "Typed dynamic routes, endpoints and middleware, prerendered by default and on-demand only where needed."
  order: 4
---

# Astro Routing

Every file in `src/pages/` is a route. Astro prerenders all of them by default;
individual routes opt into on-demand rendering. This skill keeps routes typed,
predictable and static wherever possible.

## When to use

- Adding dynamic pages (`[slug]`, `[...path]`), pagination, or JSON/RSS endpoints.
- Adding auth, redirects, headers or locale detection via middleware.
- Auditing hardcoded internal links, route collisions or accidental SSR.

## Workflow

1. **Inventory.** Run the scanner (see the `astro` skill); note `output`, adapter,
   and `links.hardcoded-internal` / `config.legacy-output-hybrid` findings. List
   routes: `rg --files src/pages` and `rg -n "prerender" src/pages`.
2. **Choose rendering per route.**

   | Route needs | Rendering |
   |-------------|-----------|
   | Same content for everyone, known at build | Prerendered (default) |
   | Per-request data (cookies, auth, search params) | `export const prerender = false` + adapter |
   | Mostly static site, a few dynamic routes | Keep `output: 'static'`, opt out per route |
   | Mostly dynamic app | `output: 'server'`, opt *in* static pages with `prerender = true` |

   `output: 'hybrid'` was removed in Astro 5; use the rows above instead.
3. **Dynamic routes.** Prerendered `[param]` pages export `getStaticPaths` returning
   `params` (strings, or `undefined` for rest params) and `props`. Type them with
   `GetStaticPaths` and `InferGetStaticPropsType`. On-demand dynamic routes read
   `Astro.params` and must handle not-found themselves.
4. **Endpoints.** `src/pages/*.ts` exporting `GET`/`POST`/… typed as `APIRoute`.
   Static endpoints are emitted as files at build (`rss.xml.ts`, `robots.txt.ts`).
5. **Middleware.** `src/middleware.ts` exports `onRequest` built with
   `defineMiddleware`; compose several with `sequence()`. Type `Astro.locals` in
   `src/env.d.ts`. Middleware runs at build for prerendered pages, so request-only
   data (cookies, headers) is only meaningful on on-demand routes.
6. **Links.** No hardcoded internal paths when the site uses i18n or a `base`: use
   `getRelativeLocaleUrl(locale, path)` from `astro:i18n` and `import.meta.env.BASE_URL`.
   Pick one `trailingSlash` policy and follow it in every link.
7. **Error pages.** `src/pages/404.astro` always; `500.astro` for on-demand sites.
8. **Verify.** `astro check`, `astro build`, then confirm the route list in the build
   output (prerendered vs `λ` on-demand) matches the plan; `astro preview` and
   request each dynamic route plus one that should 404.

## Patterns

Typed static paths from a content collection:

```astro
---
// src/pages/blog/[slug].astro
import type { GetStaticPaths, InferGetStaticPropsType } from 'astro';
import { getCollection, render } from 'astro:content';

export const getStaticPaths = (async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
const { post } = Astro.props;
const { Content } = await render(post);
---
<h1>{post.data.title}</h1>
<Content />
```

Pagination:

```astro
---
// src/pages/blog/[...page].astro  →  /blog, /blog/2, /blog/3
import type { GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

export const getStaticPaths = (async ({ paginate }) => {
  const posts = (await getCollection('blog')).sort((a, b) => +b.data.date - +a.data.date);
  return paginate(posts, { pageSize: 10 });
}) satisfies GetStaticPaths;

const { page } = Astro.props;
---
{page.data.map((post) => <a href={`/blog/${post.id}`}>{post.data.title}</a>)}
{page.url.prev && <a href={page.url.prev} rel="prev">Newer</a>}
{page.url.next && <a href={page.url.next} rel="next">Older</a>}
```

On-demand route and endpoint:

```ts
// src/pages/api/search.ts
import type { APIRoute } from 'astro';
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return Response.json({ error: 'query too short' }, { status: 400 });
  return Response.json({ q, results: [] });
};
```

Middleware with typed locals:

```ts
// src/middleware.ts
import { defineMiddleware, sequence } from 'astro:middleware';
import { getUser } from '@/lib/auth'; // your session lookup

const auth = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();
  context.locals.user = await getUser(context.cookies.get('session')?.value);
  if (context.url.pathname.startsWith('/account') && !context.locals.user) {
    return context.redirect('/login', 302);
  }
  return next();
});

const headers = defineMiddleware(async (_, next) => {
  const res = await next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  return res;
});

export const onRequest = sequence(auth, headers);
```

```ts
// src/env.d.ts
declare namespace App {
  interface Locals { user?: { id: string; email: string } }
}
```

`context.isPrerendered` exists in recent majors; confirm it in the installed
`astro` types before relying on it. Permanent moves go in
config: `redirects: { '/old': '/new', '/blog/[slug]': '/posts/[slug]' }`.
`Astro.rewrite('/404')` serves another route's content without changing the URL.

## Checklist

- [ ] Every route is prerendered unless it needs per-request data.
- [ ] No `output: 'hybrid'`; on-demand routes have an adapter installed.
- [ ] `getStaticPaths` typed with `satisfies GetStaticPaths`; props via `InferGetStaticPropsType`.
- [ ] Params are strings; rest params use `undefined` for the root.
- [ ] Endpoints typed as `APIRoute` and validate input; errors return proper status codes.
- [ ] Middleware uses `defineMiddleware`/`sequence`; `App.Locals` is typed.
- [ ] Internal links respect `base`, i18n and the `trailingSlash` policy.
- [ ] `404.astro` exists (and `500.astro` for on-demand sites).
- [ ] Legacy URLs covered by `redirects`.

## Common mistakes

- **Reading cookies/headers in prerendered pages.** They are empty at build time;
  move that logic to an on-demand route.
- **Numbers in `params`.** Params must be strings (`String(n)`), or the build fails.
- **Route collisions.** `[slug].astro` and `[...slug].astro` in one folder: static
  routes beat dynamic, named params beat rest params; know which wins.
- **Hardcoded `/about` links** on a site with `base` or locales (scanner rule
  `links.hardcoded-internal`).
- **Using `Astro.glob()`** to build paths. Removed; use `getCollection`.
- **Redirecting inside a page's HTML** with `<meta http-equiv="refresh">` when a
  config `redirects` entry or `Astro.redirect()` would send a real 301/302.

## Output

Return a route table (path, file, rendering, params source), the applied diffs, and
the build's route summary. Flag any route that became on-demand and why.
