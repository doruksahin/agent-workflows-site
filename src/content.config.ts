import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const tag = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase kebab-case tags');
const notes = defineCollection({
  loader: glob({ pattern: '*/index.{md,mdx}', base: './src/content/notes', generateId: ({ entry }) => entry.split('/')[0] }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(tag).min(1).refine(t => new Set(t).size === t.length, 'Duplicate tag'),
    source: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});
export const collections = { notes };
