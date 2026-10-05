import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import { imageMetadata } from 'astro/assets/utils';
import { folderUrl, isDoc, isImage, isReadme, linkedFiles, noteUrl, viewUrl } from '../../scripts/note-paths.mjs';

export type Note = CollectionEntry<'knowledgeBase'>;
export const entriesDir = 'src/content/knowledge-base';
export async function publishedEntries(): Promise<Note[]> {
  const entries = await getCollection('knowledgeBase', ({ data }) => import.meta.env.DEV || !data.draft);
  return entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id));
}
export const noteTags = (entries: Note[]) => [...new Set(entries.flatMap(n => n.data.tags))].sort();
export const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
/** Knowledge base grouped by calendar day, in the order given. */
export function groupByDate(entries: Note[]) {
  const groups: { label: string; date: Date; entries: Note[] }[] = [];
  for (const note of entries) {
    const label = formatDate(note.data.date);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.entries.push(note);
    else groups.push({ label, date: note.data.date, entries: [note] });
  }
  return groups;
}
/** Source path under src/content/knowledge-base/, such as observability/README.mdx. */
export const noteSource = (note: Note) => note.filePath!.slice(entriesDir.length + 1);
export const notePath = (note: Note) => noteUrl(noteSource(note));
export const noteFolder = (note: Note) => noteSource(note).split('/').slice(0, -1).join('/');

/** url is the page or raw URL; href is the link in trees and listings (an image's gallery deep link). usedIn lists the published docs that link to or embed a file. */
export type TreeFile = { kind: 'doc' | 'file'; name: string; rel: string; url: string; href: string; note?: Note; usedIn: { name: string; url: string }[] };
export type TreeFolder = { kind: 'folder'; name: string; rel: string; url: string; children: (TreeFolder | TreeFile)[]; readme?: Note };
/** Published Markdown files plus the attachments they link to or embed, as source-named folders. */
export function noteTree(entries: Note[]): TreeFolder {
  const root: TreeFolder = { kind: 'folder', name: 'knowledge-base', rel: '', url: folderUrl(''), children: [] };
  const folder = (rel: string): TreeFolder => rel.split('/').reduce((dir, name, i, parts) => {
    const path = parts.slice(0, i + 1).join('/');
    let next = dir.children.find((c): c is TreeFolder => c.kind === 'folder' && c.name === name);
    if (!next) dir.children.push(next = { kind: 'folder', name, rel: path, url: folderUrl(path), children: [] });
    return next;
  }, root);
  const add = (rel: string, kind: TreeFile['kind'], note?: Note) => {
    const dir = rel.includes('/') ? folder(rel.slice(0, rel.lastIndexOf('/'))) : root;
    let file = dir.children.find((c): c is TreeFile => c.kind !== 'folder' && c.rel === rel);
    if (!file) dir.children.push(file = { kind, name: rel.split('/').pop()!, rel, url: noteUrl(rel), href: viewUrl(rel), note, usedIn: [] });
    return { dir, file };
  };
  for (const note of entries) {
    const rel = noteSource(note);
    const { dir } = add(rel, 'doc', note);
    if (isReadme(rel)) dir.readme = note;
    for (const target of new Set(linkedFiles(rel, note.body ?? '')))
      if (!isDoc(target) && existsSync(join(entriesDir, target)) && statSync(join(entriesDir, target)).isFile()) add(target, 'file').file.usedIn.push({ name: rel.split('/').pop()!, url: noteUrl(rel) });
  }
  const sort = (dir: TreeFolder) => { dir.children.sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)); dir.children.forEach(c => c.kind === 'folder' && sort(c)); };
  sort(root);
  return root;
}
export const treeFolders = (dir: TreeFolder): TreeFolder[] => [dir, ...dir.children.flatMap(c => c.kind === 'folder' ? treeFolders(c) : [])];
export const treeAttachments = (dir: TreeFolder): TreeFile[] => treeFolders(dir).flatMap(d => d.children.filter((c): c is TreeFile => c.kind === 'file'));

export type GalleryImage = { file: TreeFile; meta: string; format: string; thumb: { src: string; width?: number; height?: number } };
const rasters = import.meta.glob<{ default: ImageMetadata }>('/src/content/knowledge-base/**/*.{gif,jpg,png,webp}');
const fileSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
/** The published images in a folder, with build-time dimensions, size, and an optimized thumbnail (the raw SVG for an SVG). */
export async function galleryImages(dir: TreeFolder): Promise<GalleryImage[]> {
  const files = dir.children.filter((c): c is TreeFile => c.kind === 'file' && isImage(c.rel));
  return Promise.all(files.map(async file => {
    const data = readFileSync(join(entriesDir, file.rel));
    const { width, height, format } = await imageMetadata(data, file.rel).catch(() => ({ width: undefined, height: undefined, format: file.rel.split('.').pop()! }));
    const meta = [width && height ? `${width}×${height}` : 'SVG', fileSize(data.length)].join(' · ');
    const load = rasters[`/${entriesDir}/${file.rel}`];
    const thumb = load ? await getImage({ src: (await load()).default, width: Math.min(480, width ?? 480), format: 'webp' }) : null;
    return { file, meta, format: format.toUpperCase(), thumb: thumb ? { src: thumb.src, width: Number(thumb.attributes.width), height: Number(thumb.attributes.height) } : { src: file.url, width, height } };
  }));
}
