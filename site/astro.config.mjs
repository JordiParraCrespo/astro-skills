import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves project sites under /<repo>; override both for a custom domain.
const site = process.env.SITE_URL ?? 'https://jordiparracrespo.github.io';
const base = process.env.BASE_PATH ?? '/astro-skills';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'always' },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: { shikiConfig: { theme: 'github-dark-default' } },
  vite: {
    plugins: [tailwindcss()],
    server: { fs: { allow: ['..'] } },
  },
});
