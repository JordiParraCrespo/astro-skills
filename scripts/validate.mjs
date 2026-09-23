#!/usr/bin/env node
// Structural checks for the plugin: skills, agents, manifests and the orchestrator table stay in sync.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const errors = [];
const fail = (msg) => errors.push(msg);

function frontmatter(file) {
  const text = readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return fail(`${file}: missing frontmatter`), null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([\w-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return { fm, body: text.slice(m[0].length) };
}

const skillDirs = readdirSync(join(root, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const orders = new Set();
for (const dir of skillDirs) {
  const file = join(root, 'skills', dir, 'SKILL.md');
  if (!existsSync(file)) {
    fail(`skills/${dir}: missing SKILL.md`);
    continue;
  }
  const parsed = frontmatter(file);
  if (!parsed) continue;
  const { fm, body } = parsed;
  if (fm.name !== dir) fail(`skills/${dir}: name "${fm.name}" must match directory`);
  if (!fm.description || fm.description.length > 1024) fail(`skills/${dir}: description missing or over 1024 chars`);
  if (!/Triggers on:/.test(fm.description ?? '')) fail(`skills/${dir}: description must end with "Triggers on: ..."`);
  for (const key of ['category', 'command', 'tagline', 'order', 'version']) if (!fm[key]) fail(`skills/${dir}: metadata.${key} missing`);
  if (orders.has(fm.order)) fail(`skills/${dir}: duplicate order ${fm.order}`);
  orders.add(fm.order);
  if (dir !== 'astro') {
    for (const h of ['## When to use', '## Workflow', '## Checklist']) if (!body.includes(h)) fail(`skills/${dir}: missing section "${h}"`);
  }
  const prose = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  for (const m of prose.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)) {
    if (!existsSync(join(root, 'skills', dir, m[1]))) fail(`skills/${dir}: broken link ${m[1]}`);
  }
}

const orchestrator = readFileSync(join(root, 'skills/astro/SKILL.md'), 'utf8');
for (const dir of skillDirs.filter((d) => d !== 'astro')) {
  if (!orchestrator.includes(`\`${dir}\``)) fail(`skills/astro/SKILL.md: sub-skill ${dir} is not routed`);
}

const agentFiles = readdirSync(join(root, 'agents')).filter((f) => f.endsWith('.md'));
for (const f of agentFiles) {
  const parsed = frontmatter(join(root, 'agents', f));
  if (!parsed) continue;
  if (parsed.fm.name !== f.replace(/\.md$/, '')) fail(`agents/${f}: name must match file name`);
  if (!parsed.fm.description) fail(`agents/${f}: description missing`);
  if (!orchestrator.includes(`\`${parsed.fm.name}\``)) fail(`agents/${f}: not referenced by the orchestrator`);
}

const plugin = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8'));
const market = JSON.parse(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (plugin.version !== pkg.version) fail(`plugin.json version ${plugin.version} != package.json ${pkg.version}`);
if (!market.plugins?.some((p) => p.name === plugin.name)) fail('marketplace.json does not list the plugin');

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${skillDirs.length} skills, ${agentFiles.length} agents, manifests in sync`);
