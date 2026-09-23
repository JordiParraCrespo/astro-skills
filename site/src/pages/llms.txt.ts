import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { GITHUB_URL, SITE_DESCRIPTION, summaryOf } from '../lib/site';

export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const skills = (await getCollection('skills')).sort((a, b) => a.data.metadata.order - b.data.metadata.order);
  const agents = await getCollection('agents');
  const body = [
    '# Astro Skills',
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    `Source: ${GITHUB_URL}`,
    '',
    '## Skills',
    '',
    ...skills.map(
      (s) => `- [${s.data.name}](${new URL(`${base}/skills/${s.id}`, site).href}): ${summaryOf(s.data.description)}`,
    ),
    '',
    '## Agents',
    '',
    ...agents.map((a) => `- ${a.data.name}: ${a.data.description}`),
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
