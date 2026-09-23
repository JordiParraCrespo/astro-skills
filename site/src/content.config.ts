import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const CATEGORIES = ['core', 'foundations', 'content', 'performance', 'quality', 'ship'] as const;

// The skills and agents ARE the content: the site reads them straight from the plugin.
const skills = defineCollection({
  loader: glob({
    pattern: '*/SKILL.md',
    base: '../skills',
    generateId: ({ entry }) => entry.split('/')[0]!,
  }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    'argument-hint': z.string().optional(),
    metadata: z.object({
      version: z.string(),
      category: z.enum(CATEGORIES),
      command: z.string(),
      tagline: z.string(),
      order: z.number(),
    }),
  }),
});

const agents = defineCollection({
  loader: glob({ pattern: '*.md', base: '../agents' }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    model: z.string().optional(),
    tools: z.string().optional(),
  }),
});

export const collections = { skills, agents };
