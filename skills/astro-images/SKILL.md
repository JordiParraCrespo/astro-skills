---
name: astro-images
description: "Optimize images in Astro projects with astro:assets. Audits raw <img> tags, missing dimensions and alt text, un-optimized public/ images, LCP image priority, responsive layouts, remote image allow-lists and image-driven CLS. Triggers on: Astro image, <Image>, <Picture>, astro:assets, getImage, responsive images, LCP image, image optimization Astro, sharp."
user-invocable: true
argument-hint: "[path]"
license: MIT
metadata:
  version: "0.1.0"
  category: performance
  command: "/astro images [path]"
  tagline: "Moves every image through astro:assets with correct sizes, formats, alt text and LCP priority."
  order: 9
---

# Astro Images

Images are usually the largest bytes on an Astro page and the most common cause of
a slow LCP and layout shift. This skill moves images through `astro:assets` so they
are resized, re-encoded and emitted with intrinsic dimensions at build time.

## When to use

- Lighthouse flags "Properly size images", "Serve images in next-gen formats",
  "Largest Contentful Paint element" or CLS from images.
- The project has raw `<img>` tags pointing into `src/` or `public/`.
- Adding a hero, gallery, blog cover or CMS/remote image.

## Workflow

1. **Inventory.** Run the scanner (see the `astro` skill) and read the
   `images.*` findings. Then grep for anything it cannot see:
   `rg -n "<img|background-image|url\(" src`.
2. **Classify every image:**
   | Source | Treatment |
   |--------|-----------|
   | File in `src/` (imported) | `<Image src={imported} alt="…" />` — dimensions inferred |
   | Frontmatter of a collection entry | `image()` in the collection schema, then `<Image>` |
   | Remote URL | Add the host to `image.domains` / `image.remotePatterns`, pass `width`/`height` or `inferSize` |
   | File in `public/` | Move to `src/assets/` unless it must keep a stable URL (favicons, OG images referenced by absolute URL) |
   | Decorative CSS background | Keep in CSS, but use `getImage()` to emit an optimized URL if it is above the fold |
3. **Fix the LCP image first.** The largest above-the-fold image gets
   `loading="eager"`, `fetchpriority="high"` and no lazy placeholder. Use the
   `priority` attribute where the installed version supports it (it sets all three).
   Everything else stays lazy (the default).
4. **Make it responsive.** Prefer the responsive layout API when available
   (`layout="constrained" | "full-width" | "fixed"`, or `image.layout` globally in
   `astro.config`). Otherwise pass `widths` and `sizes` explicitly. `sizes` must
   describe the rendered width, e.g. `sizes="(min-width: 1024px) 768px, 100vw"`.
5. **Formats.** `<Picture formats={['avif', 'webp']} />` for photographic heroes;
   `<Image>` (WebP by default) is enough elsewhere. SVG logos and icons stay as SVG.
6. **Alt text.** Informative images describe their content and purpose; decorative
   images get `alt=""`. Never repeat nearby caption text verbatim.
7. **Verify.** `astro build`, then check `dist/_astro/` contains the resized
   variants and the page HTML has `width`, `height`, `srcset` and `sizes`.

## Patterns

```astro
---
import { Image, Picture } from 'astro:assets';
import hero from '../assets/hero.jpg';
---
<Picture
  src={hero}
  formats={['avif', 'webp']}
  alt="Team reviewing a pull request on a large monitor"
  widths={[480, 960, 1440]}
  sizes="(min-width: 1024px) 1200px, 100vw"
  loading="eager"
  fetchpriority="high"
/>
```

```ts
// src/content.config.ts — validated, optimizable cover images
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      cover: image(),
      coverAlt: z.string(),
    }),
});

export const collections = { blog };
```

> `z` is exported from `astro/zod` in recent majors and from `astro:content` in
> older ones. Match whatever the project already imports.

## Checklist

- [ ] No raw `<img>` for files under `src/` (use `<Image>`/`<Picture>`).
- [ ] Every image has `width`/`height` (inferred or explicit) → no CLS.
- [ ] Exactly one eager, high-priority image per page (the LCP element), none lazy above the fold.
- [ ] `sizes` matches the real rendered width at each breakpoint.
- [ ] Remote hosts are allow-listed in `image.domains` / `image.remotePatterns`.
- [ ] Alt text present; decorative images use `alt=""`.
- [ ] `public/` holds only files that need stable, unhashed URLs.
- [ ] Image service is `sharp` (default) and `sharp` installs on the deploy target.

## Common mistakes

- **Lazy-loading the hero.** The default is `loading="lazy"`; the LCP image must
  override it.
- **Oversized `widths`.** Generating 3000px variants for a 700px column wastes build
  time and bytes. Cap at ~2× the largest rendered width.
- **`public/` images in Markdown.** `![](/img/x.png)` bypasses optimization; use a
  relative path (`![](./x.png)`) so the Markdown pipeline optimizes it.
- **Serverless without sharp.** Some edge runtimes cannot run `sharp`; use the
  host's image service or prerender image-heavy pages.

## Output

Return a table of images (file:line, current state, fix, expected byte saving), the
applied diff, and the verification command. Close with the LCP element per page.
