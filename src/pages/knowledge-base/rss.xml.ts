import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { notePath, publishedEntries } from '../../lib/entries';

export async function GET(context: APIContext) {
  const entries = await publishedEntries();
  return rss({
    title: 'Agent Workflows knowledge base',
    description: 'Learned experience from building and running agent workflows.',
    site: context.site!,
    trailingSlash: true,
    items: entries.map(n => ({ title: n.data.title, description: n.data.summary, pubDate: n.data.date, link: notePath(n), categories: n.data.tags })),
  });
}
