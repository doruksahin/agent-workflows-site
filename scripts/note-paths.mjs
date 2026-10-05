// URL rules for src/content/knowledge-base/. The loader, the routes, the link plugin, and check-site use only these.
import { posix } from 'node:path';

export const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
export const RESERVED_ROOT = ['tags', 'rss.xml'];
export const isDoc = rel => /\.mdx?$/.test(rel);
const parent = rel => posix.dirname(rel).replace(/^\.$/, '');
/** Collection ID: the path without extension. A README is an ordinary note; a folder URL is its file listing. */
export const noteId = rel => rel.replace(/\.mdx?$/, '');
export const folderUrl = dir => dir ? `/knowledge-base/${dir}/` : '/knowledge-base/';
/** Page URL for a Markdown file, raw URL for an attachment. */
export const noteUrl = rel => isDoc(rel) ? folderUrl(noteId(rel)) : `/knowledge-base/${rel}`;
/** Image extensions that have a raw route and open in the folder gallery's viewer. */
export const isImage = rel => /\.(?:gif|jpg|png|svg|webp)$/.test(rel);
/** Link in the file tree and folder listings: the folder gallery's deep link for an image in a folder, else noteUrl. */
export const viewUrl = rel => isImage(rel) && parent(rel) ? `${folderUrl(parent(rel))}#${posix.basename(rel)}` : noteUrl(rel);

export function pathErrors(rel) {
  const errors = rel.split('/').filter(s => !SAFE_SEGMENT.test(s)).map(s => `Unsafe path segment "${s}" in ${rel}: use A-Z a-z 0-9 . _ -`);
  const first = (isDoc(rel) ? noteId(rel) : rel).split('/')[0];
  if (RESERVED_ROOT.includes(first)) errors.push(`Reserved root name "${first}" in ${rel}`);
  return errors;
}

/** Sources (files, and folders as "dir/") that would share a URL. */
export function urlCollisions(rels) {
  const claims = new Map();
  const claim = (key, source) => claims.set(key, [...new Set([...(claims.get(key) ?? []), source])]);
  for (const rel of rels) {
    claim(noteUrl(rel).replace(/\/$/, ''), rel);
    const parts = rel.split('/');
    for (let i = 1; i < parts.length; i++) claim(folderUrl(parts.slice(0, i).join('/')).replace(/\/$/, ''), parts.slice(0, i).join('/') + '/');
  }
  const folderish = x => x.endsWith('/');
  return [...claims].filter(([, s]) => s.filter(x => !folderish(x)).length + (s.some(folderish) ? 1 : 0) > 1)
    .map(([key, s]) => `URL ${key}${s.some(x => x.endsWith('/') || isDoc(x)) ? '/' : ''} is claimed by ${s.join(', ')}`);
}

const isRelative = t => !!t && !/^(?:[a-z][a-z0-9+.-]*:|[#/?])/i.test(t);
/** Relative Markdown link, image, and definition targets in a body, outside code. Raw HTML src/href is
 * not rewritten, so it is not a reference here; check-site rejects it in the built page. A [^x]: line
 * is a GFM footnote definition, not a link definition. */
export function relativeTargets(body) {
  const text = body.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[`~]*[ \t]*$|(?![\s\S]))/gm, '').replace(/(`+)[\s\S]*?\1/g, '');
  const found = [];
  for (const m of text.matchAll(/!?\[[^\]]*\]\(\s*(<[^>]*>|[^\s)]+)|^ {0,3}\[(?!\^)[^\]]+\]:\s*(<[^>]*>|\S+)/gm)) {
    const t = (m[1] ?? m[2]).replace(/^<|>$/g, '');
    if (isRelative(t)) found.push(t);
  }
  return found;
}

/** Resolves a relative target from a source file: { rel, hash, outside }, or null if it is not relative. */
export function resolveTarget(fromRel, target) {
  if (!isRelative(target)) return null;
  const [, path, hash = ''] = target.match(/^([^#?]*)(?:\?[^#]*)?(#.*)?$/);
  const rel = posix.normalize(posix.join(parent(fromRel), decodeURI(path))).replace(/\/$/, '').replace(/^\.$/, '');
  return { rel, hash, outside: rel === '..' || rel.startsWith('../') };
}

export const linkedFiles = (fromRel, body) => relativeTargets(body).map(t => resolveTarget(fromRel, t)).filter(t => !t.outside).map(t => t.rel);
