#!/usr/bin/env node
// Deterministic, zero-dependency scanner for Astro projects.
// Usage: node astro-scan.mjs [path] [--json]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const WEIGHTS = { critical: 15, high: 8, medium: 3, low: 1 };
export const CATEGORIES = ['architecture', 'performance', 'seo', 'accessibility', 'security'];

export const RULES = {
  'config.missing-site': {
    severity: 'medium',
    category: 'seo',
    message: '`site` is not set in astro.config; canonical URLs, sitemap and RSS cannot be absolute.',
    fix: "Set `site: 'https://example.com'` in astro.config.",
  },
  'config.legacy-output-hybrid': {
    severity: 'critical',
    category: 'architecture',
    message: "`output: 'hybrid'` was removed; static is the default and pages opt out individually.",
    fix: "Remove `output: 'hybrid'` and add `export const prerender = false` to on-demand pages.",
  },
  'config.no-sitemap': {
    severity: 'medium',
    category: 'seo',
    message: 'No sitemap integration or sitemap endpoint found.',
    fix: 'Run `npx astro add sitemap` (requires `site`).',
  },
  'content.legacy-config': {
    severity: 'high',
    category: 'architecture',
    message: 'Legacy `src/content/config.ts` found; collections now live in `src/content.config.ts` with loaders.',
    fix: 'Move to `src/content.config.ts` and define each collection with a `glob()` or `file()` loader.',
  },
  'api.astro-glob': {
    severity: 'high',
    category: 'architecture',
    message: '`Astro.glob()` was removed.',
    fix: 'Use `import.meta.glob()` or a content collection.',
  },
  'api.view-transitions-renamed': {
    severity: 'high',
    category: 'architecture',
    message: '`<ViewTransitions />` was renamed to `<ClientRouter />`.',
    fix: "Import `{ ClientRouter } from 'astro:transitions'`, or use CSS `@view-transition { navigation: auto; }` for zero JS.",
  },
  'islands.client-load': {
    severity: 'medium',
    category: 'performance',
    message: '`client:load` hydrates immediately and competes with the LCP.',
    fix: 'Use `client:visible`, `client:idle` or `client:media` unless the island is interactive above the fold.',
  },
  'images.raw-img': {
    severity: 'medium',
    category: 'performance',
    message: 'Raw `<img>` bypasses `astro:assets` (no resizing, modern formats or intrinsic size).',
    fix: "Use `<Image>` or `<Picture>` from 'astro:assets'.",
  },
  'images.img-missing-alt': {
    severity: 'high',
    category: 'accessibility',
    message: 'Image without an `alt` attribute.',
    fix: 'Describe informative images; use `alt=""` for decorative ones.',
  },
  'links.hardcoded-internal': {
    severity: 'low',
    category: 'seo',
    message: 'Hardcoded internal link in an i18n project; it will not follow the current locale.',
    fix: "Use `getRelativeLocaleUrl(Astro.currentLocale, '/path')` from 'astro:i18n'.",
  },
  'styles.raw-color': {
    severity: 'low',
    category: 'architecture',
    message: 'Raw color literal in a component; it will not follow the theme.',
    fix: 'Reference a design token (CSS custom property) instead.',
  },
  'seo.no-robots': {
    severity: 'low',
    category: 'seo',
    message: 'No robots.txt (static file or endpoint).',
    fix: 'Add `src/pages/robots.txt.ts` that points to the sitemap.',
  },
  'seo.no-canonical': {
    severity: 'medium',
    category: 'seo',
    message: 'No `rel="canonical"` link found in any layout or page.',
    fix: 'Emit `<link rel="canonical" href={new URL(Astro.url.pathname, Astro.site)} />` in the base layout.',
  },
  'env.process-env': {
    severity: 'medium',
    category: 'security',
    message: '`process.env` in source code; values are untyped and may be undefined at runtime.',
    fix: 'Declare variables with `envField` in `env.schema` and import from `astro:env/server` or `astro:env/client`.',
  },
  'ts.not-strict': {
    severity: 'low',
    category: 'architecture',
    message: 'tsconfig does not extend `astro/tsconfigs/strict` or `strictest`.',
    fix: 'Set `"extends": "astro/tsconfigs/strict"`.',
  },
  'a11y.positive-tabindex': {
    severity: 'medium',
    category: 'accessibility',
    message: 'Positive `tabindex` breaks the natural focus order.',
    fix: 'Use `tabindex="0"` or restructure the DOM order.',
  },
  'a11y.click-on-div': {
    severity: 'medium',
    category: 'accessibility',
    message: 'Click handler on a non-interactive element; unreachable by keyboard.',
    fix: 'Use a `<button>` (or `<a href>` for navigation).',
  },
  'security.set-html': {
    severity: 'medium',
    category: 'security',
    message: '`set:html` with a dynamic value; unsanitized input becomes XSS.',
    fix: 'Sanitize the value or render it as text. JSON-LD via `JSON.stringify` is fine.',
  },
  'deps.multiple-frameworks': {
    severity: 'low',
    category: 'performance',
    message: 'More than one UI framework is installed; each ships its own runtime.',
    fix: 'Consolidate islands on one framework, or replace small islands with vanilla scripts.',
  },
};

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.astro', '.git', '.vercel', '.netlify', '.output', 'coverage']);
const SOURCE_EXTS = new Set(['.astro', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.mdx', '.vue', '.svelte']);
const FRAMEWORKS = ['react', 'preact', 'vue', 'svelte', 'solid-js', '@builder.io/qwik', 'lit', 'alpinejs'];
const LINE_RULE_LIMIT = 25;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (IGNORED_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (SOURCE_EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function findConfig(root) {
  for (const ext of ['mjs', 'ts', 'js', 'mts', 'cjs']) {
    const f = join(root, `astro.config.${ext}`);
    if (existsSync(f)) return f;
  }
  return null;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

// Only the template part of an .astro file; frontmatter is TypeScript.
function templateOf(text) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---/);
  return m ? { body: text.slice(m[0].length), offset: m[0].length } : { body: text, offset: 0 };
}

function stripComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
}

export function scan(rootArg = '.') {
  const root = resolve(rootArg);
  const pkg = readJson(join(root, 'package.json'));
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const configFile = findConfig(root);
  const isAstroProject = Boolean(deps.astro || configFile);

  const result = {
    root,
    isAstroProject,
    astroVersion: deps.astro ?? null,
    astroMajor: parseMajor(deps.astro),
    configFile: configFile ? relative(root, configFile) : null,
    output: 'static',
    adapter: null,
    integrations: [],
    frameworks: [],
    i18n: false,
    counts: { pages: 0, components: 0, layouts: 0, collections: 0, islands: 0, sourceFiles: 0 },
    findings: [],
  };
  if (!isAstroProject) return finalize(result);

  const config = configFile ? readFileSync(configFile, 'utf8') : '';
  const findings = result.findings;
  const add = (rule, file, line, detail) => {
    if (findings.filter((f) => f.rule === rule).length >= LINE_RULE_LIMIT) return;
    const r = RULES[rule];
    findings.push({ rule, severity: r.severity, category: r.category, file: file ? relative(root, file) : null, line: line ?? null, message: detail ?? r.message, fix: r.fix });
  };

  const outMatch = config.match(/output\s*:\s*['"](\w+)['"]/);
  if (outMatch) result.output = outMatch[1];
  if (result.output === 'hybrid') add('config.legacy-output-hybrid', configFile, lineOf(config, outMatch.index));

  const adapters = ['@astrojs/node', '@astrojs/vercel', '@astrojs/netlify', '@astrojs/cloudflare', '@deno/astro-adapter'];
  result.adapter = adapters.find((a) => deps[a]) ?? null;
  result.integrations = Object.keys(deps).filter((d) => d.startsWith('@astrojs/') && !adapters.includes(d)).sort();
  result.frameworks = FRAMEWORKS.filter((f) => deps[f]);
  result.i18n = /\bi18n\s*:/.test(config);

  if (configFile && !/\bsite\s*:/.test(config)) add('config.missing-site', configFile, null);
  if (result.frameworks.length > 1) add('deps.multiple-frameworks', join(root, 'package.json'), null, `${RULES['deps.multiple-frameworks'].message} Found: ${result.frameworks.join(', ')}.`);

  const tsconfig = readJson(join(root, 'tsconfig.json'));
  const ext = [tsconfig?.extends].flat().filter(Boolean).join(' ');
  if (tsconfig && !/astro\/tsconfigs\/(strict|strictest)/.test(ext)) add('ts.not-strict', join(root, 'tsconfig.json'), null);

  const src = join(root, 'src');
  const files = walk(src);
  result.counts.sourceFiles = files.length;
  const legacyContent = ['ts', 'js', 'mjs', 'mts'].map((e) => join(src, 'content', `config.${e}`)).find(existsSync);
  if (legacyContent) add('content.legacy-config', legacyContent, 1);

  let hasCanonical = false;
  let hasSitemapEndpoint = false;
  let hasRobots = existsSync(join(root, 'public', 'robots.txt'));

  for (const file of files) {
    const rel = relative(src, file).split('\\').join('/');
    const text = readFileSync(file, 'utf8');
    const isAstro = file.endsWith('.astro');
    if (rel.startsWith('pages/')) {
      result.counts.pages++;
      if (/^pages\/robots\.txt\.(ts|js)$/.test(rel)) hasRobots = true;
      if (/^pages\/sitemap[^/]*\.xml\.(ts|js)$/.test(rel)) hasSitemapEndpoint = true;
    } else if (rel.startsWith('layouts/')) result.counts.layouts++;
    else if (rel.startsWith('components/')) result.counts.components++;
    if (/^content\.config\.(ts|js|mjs|mts)$/.test(rel)) {
      result.counts.collections = (text.match(/defineCollection\s*\(/g) ?? []).length;
    }

    if (/rel=["']canonical["']/.test(text)) hasCanonical = true;
    for (const m of text.matchAll(/Astro\.glob\s*\(/g)) add('api.astro-glob', file, lineOf(text, m.index));
    for (const m of text.matchAll(/\bViewTransitions\b/g)) add('api.view-transitions-renamed', file, lineOf(text, m.index));
    for (const m of text.matchAll(/\bprocess\.env\b/g)) {
      if (!/\.(astro|ts|tsx|js|jsx|mjs)$/.test(file)) continue;
      add('env.process-env', file, lineOf(text, m.index));
    }

    if (!isAstro && !/\.(jsx|tsx|vue|svelte)$/.test(file)) continue;
    const { body, offset } = isAstro ? templateOf(text) : { body: text, offset: 0 };
    const tpl = stripComments(body);
    const at = (i) => lineOf(text, offset + i);

    for (const m of tpl.matchAll(/client:(load|idle|visible|media|only)\b/g)) {
      result.counts.islands++;
      if (m[1] === 'load') add('islands.client-load', file, at(m.index));
    }
    if (isAstro) {
      for (const m of tpl.matchAll(/<img\b([^>]*)>/g)) {
        add('images.raw-img', file, at(m.index));
        if (!/\balt\s*=/.test(m[1])) add('images.img-missing-alt', file, at(m.index));
      }
      for (const m of tpl.matchAll(/<(?:Image|Picture)\b([^>]*)\/?>/g)) {
        if (!/\balt\s*=/.test(m[1])) add('images.img-missing-alt', file, at(m.index));
      }
      for (const m of tpl.matchAll(/set:html=\{([^}]*)\}/g)) {
        if (!/JSON\.stringify/.test(m[1])) add('security.set-html', file, at(m.index));
      }
      if (result.i18n) {
        for (const m of tpl.matchAll(/<a\b[^>]*\bhref=["'](\/(?!\/)[^"'#?]*)["']/g)) {
          if (!/\.(xml|txt|json|pdf|png|jpe?g|svg|webp|ico)$/.test(m[1])) add('links.hardcoded-internal', file, at(m.index), `${RULES['links.hardcoded-internal'].message} (${m[1]})`);
        }
      }
      if (rel.startsWith('components/') || rel.startsWith('layouts/')) {
        const styleless = tpl.replace(/<style[\s\S]*?<\/style>/g, (s) => s.replace(/[^\n]/g, ' '));
        for (const m of styleless.matchAll(/(?:class|style)=["'][^"']*(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\b(?:bg|text|border)-(?:zinc|gray|slate|neutral|stone|red|blue|green)-\d{2,3}\b)/g)) {
          add('styles.raw-color', file, at(m.index));
        }
      }
    }
    for (const m of tpl.matchAll(/tabindex=["']?\{?["']?([1-9]\d*)/g)) add('a11y.positive-tabindex', file, at(m.index));
    for (const m of tpl.matchAll(/<(div|span|li|section)\b[^>]*\bon(?:click|Click)\s*=/g)) add('a11y.click-on-div', file, at(m.index));
  }

  const sitemap = Boolean(deps['@astrojs/sitemap']) || hasSitemapEndpoint || existsSync(join(root, 'public', 'sitemap.xml'));
  if (!sitemap) add('config.no-sitemap', configFile, null);
  if (!hasRobots) add('seo.no-robots', null, null);
  if (!hasCanonical && result.counts.pages > 0) add('seo.no-canonical', null, null);

  return finalize(result);
}

function parseMajor(range) {
  const m = String(range ?? '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function score(findings) {
  const byRule = new Map();
  for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);
  const penaltyFor = (rules) =>
    [...rules].reduce((sum, [rule, count]) => {
      const w = WEIGHTS[RULES[rule].severity];
      return sum + Math.min(w * count, w * 2);
    }, 0);
  const categories = {};
  for (const c of CATEGORIES) {
    const rules = [...byRule].filter(([r]) => RULES[r].category === c);
    categories[c] = Math.max(0, 100 - penaltyFor(rules) * 2);
  }
  return { overall: Math.max(0, 100 - penaltyFor(byRule)), categories };
}

function finalize(result) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  result.findings.sort((a, b) => order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule));
  result.score = result.isAstroProject ? score(result.findings) : null;
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of result.findings) summary[f.severity]++;
  result.summary = summary;
  return result;
}

function printHuman(r) {
  if (!r.isAstroProject) {
    console.log(`Not an Astro project: ${r.root}`);
    return;
  }
  console.log(`Astro ${r.astroVersion ?? '?'} · output: ${r.output}${r.adapter ? ` · adapter: ${r.adapter}` : ''}`);
  console.log(`pages ${r.counts.pages} · components ${r.counts.components} · layouts ${r.counts.layouts} · collections ${r.counts.collections} · islands ${r.counts.islands}`);
  console.log(`Score ${r.score.overall}/100  ${CATEGORIES.map((c) => `${c} ${r.score.categories[c]}`).join(' · ')}`);
  for (const f of r.findings) {
    const loc = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : '(project)';
    console.log(`  [${f.severity}] ${f.rule} ${loc}\n    ${f.message}\n    fix: ${f.fix}`);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const path = args.find((a) => !a.startsWith('--')) ?? '.';
  const r = scan(path);
  if (args.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else printHuman(r);
  process.exitCode = r.isAstroProject ? 0 : 2;
}
