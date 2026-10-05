// Sätteri mdast plugin (Astro 7's default Markdown and MDX processor): rewrites relative links in entries
// to site URLs, so copied source files keep their links. Images stay with Astro's image pipeline.
// Missing targets and targets outside the knowledge base folder fail the build.
import { existsSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { folderUrl, noteUrl, resolveTarget } from './note-paths.mjs';

const sourceOf = (base, fileURL) => {
  const file = fileURL && fileURLToPath(fileURL);
  const fromRel = file ? relative(base, file) : '..';
  return fromRel.startsWith('..') || isAbsolute(fromRel) ? null : { file, fromRel };
};
export default function noteLinks({ entriesDir = 'src/content/knowledge-base' } = {}) {
  const base = resolve(entriesDir);
  return ({ fileURL }) => {
    const source = sourceOf(base, fileURL);
    if (!source) return null;
    const { file, fromRel } = source;
    const rewrite = (node, ctx) => {
      const target = resolveTarget(fromRel.split(sep).join('/'), node.url);
      if (!target) return;
      const where = `${relative(process.cwd(), file)}: link "${node.url}"`;
      if (target.outside) throw new Error(`${where} points outside src/content/knowledge-base/`);
      const path = join(base, target.rel);
      if (!existsSync(path)) throw new Error(`${where} points to a missing file (${target.rel})`);
      ctx.setProperty(node, 'url', (statSync(path).isDirectory() ? folderUrl(target.rel) : noteUrl(target.rel)) + target.hash);
    };
    return { name: 'note-links', link: rewrite, definition: rewrite };
  };
}

// Sätteri hast plugin: adds data-raw (the raw attachment URL) to each relative image in a note. It runs
// before Astro's image marker, which passes the attribute through to the optimized <img>, so the image
// viewer can map a /_astro/ asset back to its attachment. The link plugin has already failed the build
// for a missing or outside target.
export function noteImages({ entriesDir = 'src/content/knowledge-base' } = {}) {
  const base = resolve(entriesDir);
  return ({ fileURL }) => {
    const source = sourceOf(base, fileURL);
    if (!source) return null;
    const fromRel = source.fromRel.split(sep).join('/');
    return { name: 'note-images', element: { filter: ['img'], visit(node, ctx) {
      const src = node.properties?.src;
      const target = typeof src === 'string' && resolveTarget(fromRel, src);
      if (target && !target.outside) ctx.setProperty(node, 'data-raw', noteUrl(target.rel));
    } } };
  };
}
