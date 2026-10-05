import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { noteId, pathErrors } from '../scripts/note-paths.mjs';

const tag = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase kebab-case tags');
const generateId = ({ entry }: { entry: string }) => {
  const errors = pathErrors(entry);
  if (errors.length) throw new Error(errors.join('\n'));
  return noteId(entry);
};
const knowledgeBase = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/knowledge-base', generateId }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(tag).min(1).refine(t => new Set(t).size === t.length, 'Duplicate tag'),
    source: z.string().optional(),
    draft: z.boolean().default(false),
    // Synced from a source folder (scripts/sync-knowledge-base.mjs): the page shows the Markdown only.
    verbatim: z.boolean().default(false),
  }),
});
export const collections = { knowledgeBase };
