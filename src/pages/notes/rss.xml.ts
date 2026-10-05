import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { notePath, publishedNotes } from '../../lib/notes';

export async function GET(context: APIContext) {
  const notes = await publishedNotes();
  return rss({
    title: 'Agent Workflows notes',
    description: 'Learned experience from building and running agent workflows.',
    site: context.site!,
    trailingSlash: true,
    items: notes.map(n => ({ title: n.data.title, description: n.data.summary, pubDate: n.data.date, link: notePath(n), categories: n.data.tags })),
  });
}
