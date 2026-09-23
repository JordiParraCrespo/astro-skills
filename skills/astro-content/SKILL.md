---
name: astro-content
description: "Build and audit content collections in Astro projects. Sets up src/content.config.ts with the Content Layer (glob, file and custom loaders), strict Zod schemas, reference() relations, getCollection/getEntry queries, render(), draft filtering and migration from legacy src/content/config.ts collections. Triggers on: Astro content collections, content.config.ts, defineCollection, glob loader, file loader, content layer, getCollection, getEntry, reference(), render(), Astro.glob, legacy collections, Markdown MDX Astro."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: content
  command: "/astro content [path]"
  tagline: "Type-safe content on the Content Layer: loaders, strict schemas, references and a clean legacy migration."
  order: 7
---

# Astro Content

Content collections give every Markdown file, JSON record or CMS entry a validated,
typed shape at build time. Since Astro 5 they run on the Content Layer: each
collection declares a `loader` in `src/content.config.ts` and a Zod `schema`. This
skill sets that up, queries it correctly and migrates legacy collections.

## When to use

- The scanner reports `content.legacy-config` or `api.astro-glob`.
- Adding a blog, docs, changelog, team or product collection.
- Pulling content from JSON, YAML, a CMS or an API into typed pages.
- Build errors like "does not match collection schema" or untyped `entry.data`.

## Workflow

1. **Inventory.** Run the scanner (see the `astro` skill) and read `content.*` and
   `api.astro-glob`. Then locate the config and the call sites:
   `ls src/content.config.ts src/content/config.ts 2>/dev/null` and
   `rg -n "getCollection|getEntry|Astro.glob|import.meta.glob|\.render\(\)" src`.
2. **Pick a loader per collection:**
   | Source | Loader |
   |--------|--------|
   | Folder of `.md`/`.mdx`/`.json`/`.yaml` files, one entry per file | `glob({ pattern, base })` |
   | One JSON/YAML file holding many entries | `file('src/data/authors.json')` |
   | Remote API / CMS, fetched at build | Inline loader: `loader: async () => [...]` |
   | Reusable or incremental source (sync tokens, digests) | Object loader `{ name, load({ store, parseData, generateDigest, meta }) }` |
3. **Write strict schemas.** Required fields are required; dates use
   `z.coerce.date()`; enums use `z.enum`; images use the `image()` helper;
   relations use `reference('collection')`. Default `draft` to `false`.
4. **Query through the API.** `getCollection(name, filter)` for lists,
   `getEntry(name, id)` for one entry, `render(entry)` for Markdown/MDX bodies.
   Filter drafts in one shared helper so no page forgets.
5. **Resolve references explicitly.** A `reference()` field holds `{ collection, id }`;
   call `getEntry(ref)` / `getEntries(refs)` to load it.
6. **Migrate legacy collections** (see below) and replace every `Astro.glob()`.
7. **Verify.** `astro sync` (regenerates types), `astro check`, `astro build`.
   Break a required field in one entry to confirm the schema actually rejects it.

## Patterns

```ts
// src/content.config.ts
import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const authors = defineCollection({
  loader: file('src/data/authors.json'), // array of objects with an `id`
  schema: z.object({ name: z.string(), url: z.string().url().optional() }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(70),
      description: z.string().max(160),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      cover: image().optional(),
      tags: z.array(z.string()).default([]),
      author: reference('authors'),
      related: z.array(reference('blog')).default([]),
      draft: z.boolean().default(false),
    }),
});

const releases = defineCollection({
  loader: async () => {
    const res = await fetch('https://api.example.com/releases');
    const items: { tag: string; notes: string }[] = await res.json();
    return items.map((r) => ({ id: r.tag, ...r })); // every entry needs a unique string id
  },
  schema: z.object({ tag: z.string(), notes: z.string() }),
});

export const collections = { authors, blog, releases };
```

```ts
// src/lib/posts.ts — one place that decides what is published
import { getCollection } from 'astro:content';

export async function getPublishedPosts() {
  const posts = await getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
```

```astro
---
// src/pages/blog/[...id].astro
import { getEntry, render } from 'astro:content';
import { getPublishedPosts } from '../../lib/posts';

export async function getStaticPaths() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ params: { id: post.id }, props: { post } }));
}

const { post } = Astro.props;
const { Content, headings } = await render(post);
const author = await getEntry(post.data.author);
---
<article>
  <h1>{post.data.title}</h1>
  <p>By {author?.data.name}</p>
  <Content />
</article>
```

### Migrating legacy collections

1. Move `src/content/config.ts` to `src/content.config.ts`.
2. Replace `type: 'content'` / `type: 'data'` with
   `loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/<name>' })`
   (or `**/*.{json,yaml}` for data).
3. `entry.slug` becomes `entry.id` (the glob loader derives `id` from the file path,
   or from a `slug` frontmatter field). Rename `[...slug]` params accordingly.
4. `await entry.render()` becomes `await render(entry)` imported from `astro:content`.
5. Replace `Astro.glob()` with `getCollection()` (or `import.meta.glob` for
   non-content files).
6. Run `astro sync`, fix the reported type errors, then `astro build`.

> Legacy collections were kept behind a compatibility flag in Astro 5 and removed
> in later majors; newer majors also add live (request-time) collections. Where the
> `z` import lives (`astro/zod`, `astro:schema` or `astro:content`) also varies. Check
> the installed version in `package.json` and `https://docs.astro.build/llms.txt`,
> and match what the project already imports.

## Checklist

- [ ] Config lives at `src/content.config.ts`; every collection has a `loader`.
- [ ] No `Astro.glob()`, no `type: 'content'`, no `entry.render()` / `entry.slug`.
- [ ] Schemas are strict: required fields required, dates coerced, enums closed.
- [ ] Images in frontmatter use `image()`; relations use `reference()`.
- [ ] Drafts are filtered in one shared helper used by pages, RSS and sitemap.
- [ ] Entries are sorted explicitly (`getCollection` order is not guaranteed).
- [ ] Remote loaders handle fetch failure (throw with a clear message, do not return `[]` silently).
- [ ] `astro sync && astro check` pass with zero errors.

## Common mistakes

- **Forgetting `base` in `glob()`.** The pattern is relative to `base`; without it
  the loader matches nothing and the collection is silently empty.
- **Filtering drafts on one page only.** The RSS feed or sitemap still publishes
  them. Centralize the filter.
- **Relying on default order.** Sort by date or an `order` field every time.
- **Treating `reference()` as data.** It is only `{ collection, id }` until you
  call `getEntry`.
- **Underscore files.** Use `[^_]*` in the pattern to skip partials like `_draft.md`.
- **Leaving types stale.** After changing the config, run `astro sync` or restart
  the dev server.

## Output

Return a table of collections (name, loader, schema strictness, issues), the list
of call sites changed, the applied diff, and the `astro sync && astro check && astro build` result.
