import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scan, RULES, score } from '../skills/astro/scripts/astro-scan.mjs';

const fx = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const rules = (r) => new Set(r.findings.map((f) => f.rule));

test('clean project has no findings and a perfect score', () => {
  const r = scan(fx('clean'));
  assert.equal(r.isAstroProject, true);
  assert.equal(r.astroMajor, 5);
  assert.deepEqual(r.findings, []);
  assert.equal(r.score.overall, 100);
  assert.equal(r.counts.pages, 2);
  assert.equal(r.counts.layouts, 1);
});

test('legacy project triggers every expected rule', () => {
  const r = scan(fx('legacy'));
  const found = rules(r);
  for (const rule of [
    'config.legacy-output-hybrid',
    'config.missing-site',
    'config.no-sitemap',
    'content.legacy-config',
    'api.astro-glob',
    'api.view-transitions-renamed',
    'islands.client-load',
    'images.raw-img',
    'images.img-missing-alt',
    'links.hardcoded-internal',
    'styles.raw-color',
    'seo.no-robots',
    'seo.no-canonical',
    'env.process-env',
    'ts.not-strict',
    'a11y.positive-tabindex',
    'a11y.click-on-div',
    'security.set-html',
    'deps.multiple-frameworks',
  ]) {
    assert.ok(found.has(rule), `expected ${rule}`);
  }
  assert.equal(r.output, 'hybrid');
  assert.equal(r.counts.islands, 2);
  assert.ok(r.score.overall < 50);
});

test('every rule id is covered by a fixture and has metadata', () => {
  const r = scan(fx('legacy'));
  for (const [id, meta] of Object.entries(RULES)) {
    assert.ok(rules(r).has(id), `rule ${id} not exercised`);
    assert.ok(meta.message && meta.fix && meta.category && meta.severity);
  }
});

test('hardcoded link rule ignores asset-like paths', () => {
  const links = scan(fx('legacy')).findings.filter((f) => f.rule === 'links.hardcoded-internal');
  assert.equal(links.length, 1);
  assert.match(links[0].message, /\/about/);
});

test('findings carry file and line', () => {
  const glob = scan(fx('legacy')).findings.find((f) => f.rule === 'api.astro-glob');
  assert.equal(glob.file, 'src/pages/index.astro');
  assert.equal(glob.line, 4);
});

test('non-astro directory is reported and exits 2', () => {
  assert.equal(scan(fx('not-astro')).isAstroProject, false);
  const script = fileURLToPath(new URL('../skills/astro/scripts/astro-scan.mjs', import.meta.url));
  assert.throws(() => execFileSync('node', [script, fx('not-astro')]), (e) => e.status === 2);
});

test('score caps each rule at twice its weight', () => {
  const many = Array.from({ length: 10 }, () => ({ rule: 'images.raw-img' }));
  assert.equal(score(many).overall, 94);
});

test('CLI emits valid JSON', () => {
  const script = fileURLToPath(new URL('../skills/astro/scripts/astro-scan.mjs', import.meta.url));
  const out = JSON.parse(execFileSync('node', [script, fx('clean'), '--json'], { encoding: 'utf8' }));
  assert.equal(out.score.overall, 100);
});
