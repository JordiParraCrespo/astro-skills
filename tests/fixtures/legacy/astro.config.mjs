import { defineConfig } from 'astro/config';
export default defineConfig({
  output: 'hybrid',
  i18n: { defaultLocale: 'en', locales: ['en', 'es'] },
});
