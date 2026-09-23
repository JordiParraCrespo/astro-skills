export const REPO = 'JordiParraCrespo/astro-skills';
export const GITHUB_URL = `https://github.com/${REPO}`;
export const SITE_NAME = 'Astro Skills';
export const SITE_DESCRIPTION =
  'Claude Code skills and agents for building production-grade Astro sites: audits, islands, content collections, i18n, SEO, images, performance, accessibility and upgrades.';

export const PLUGIN_INSTALL = [`/plugin marketplace add ${REPO}`, '/plugin install astro-skills@astro-skills'];
export const MANUAL_INSTALL = [`git clone --depth 1 ${GITHUB_URL}.git`, 'bash astro-skills/install.sh'];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path = '/'): string {
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export const CATEGORY_LABELS: Record<string, { label: string; blurb: string }> = {
  core: { label: 'Core', blurb: 'Entry points: route any Astro task, or audit the whole project.' },
  foundations: { label: 'Foundations', blurb: 'Project setup, component architecture, routing and styling.' },
  content: { label: 'Content', blurb: 'Collections, translations and type-safe server actions.' },
  performance: { label: 'Performance', blurb: 'Ship less JavaScript and faster pixels.' },
  quality: { label: 'Quality', blurb: 'Rank in search engines and work for every user.' },
  ship: { label: 'Ship', blurb: 'Deploy anywhere and stay current with Astro releases.' },
};

export function triggersOf(description: string): string[] {
  const m = description.match(/Triggers on:\s*(.+?)\.?$/);
  return m ? m[1]!.split(',').map((t) => t.trim()).filter(Boolean) : [];
}

export function summaryOf(description: string): string {
  return description.replace(/\s*Triggers on:.*$/, '').trim();
}

export function shortCommand(name: string): string {
  return name === 'astro' ? '/astro' : `/astro ${name.replace(/^astro-/, '')}`;
}
