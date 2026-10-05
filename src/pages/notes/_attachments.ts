import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIContext } from 'astro';
import { noteTree, notesDir, publishedNotes, treeAttachments } from '../../lib/notes';

// Raw attachment URLs. Astro exempts an endpoint from trailingSlash: 'always' only when its route name
// ends in a literal extension, so each served extension has a one-line route: [...file].<ext>.ts.
// Only published attachments (files that a published note links to or embeds) get a path.
export const attachmentRoute = (ext: string, type: string) => ({
  getStaticPaths: async () => treeAttachments(noteTree(await publishedNotes())).filter(a => a.rel.endsWith('.' + ext)).map(a => ({ params: { file: a.rel.slice(0, -ext.length - 1) } })),
  GET: ({ params }: APIContext) => new Response(readFileSync(join(notesDir, `${params.file}.${ext}`)), { headers: { 'Content-Type': type } }),
});
