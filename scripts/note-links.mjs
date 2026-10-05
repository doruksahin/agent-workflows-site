// Sätteri mdast plugin (Astro 7's default Markdown and MDX processor): rewrites relative links in notes
// to site URLs, so copied source files keep their links. Images stay with Astro's image pipeline.
// Missing targets and targets outside the notes folder fail the build.
import { existsSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { folderUrl, noteUrl, resolveTarget } from './note-paths.mjs';

export default function noteLinks({ notesDir = 'src/content/notes' } = {}) {
  const base = resolve(notesDir);
  return ({ fileURL }) => {
    const file = fileURL && fileURLToPath(fileURL);
    const fromRel = file ? relative(base, file) : '..';
    if (fromRel.startsWith('..') || isAbsolute(fromRel)) return null;
    const rewrite = (node, ctx) => {
      const target = resolveTarget(fromRel.split(sep).join('/'), node.url);
      if (!target) return;
      const where = `${relative(process.cwd(), file)}: link "${node.url}"`;
      if (target.outside) throw new Error(`${where} points outside src/content/notes/`);
      const path = join(base, target.rel);
      if (!existsSync(path)) throw new Error(`${where} points to a missing file (${target.rel})`);
      ctx.setProperty(node, 'url', (statSync(path).isDirectory() ? folderUrl(target.rel) : noteUrl(target.rel)) + target.hash);
    };
    return { name: 'note-links', link: rewrite, definition: rewrite };
  };
}
