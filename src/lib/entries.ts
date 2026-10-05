import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { folderUrl, isDoc, linkedFiles, noteUrl } from '../../scripts/note-paths.mjs';

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

/** url is the page or raw URL. usedIn lists the published docs that link to or embed a file. */
export type TreeFile = { kind: 'doc' | 'file'; name: string; rel: string; url: string; note?: Note; usedIn: { name: string; url: string }[] };
export type TreeFolder = { kind: 'folder'; name: string; rel: string; url: string; children: (TreeFolder | TreeFile)[] };
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
    if (!file) dir.children.push(file = { kind, name: rel.split('/').pop()!, rel, url: noteUrl(rel), note, usedIn: [] });
    return { dir, file };
  };
  for (const note of entries) {
    const rel = noteSource(note);
    add(rel, 'doc', note);
    for (const target of new Set(linkedFiles(rel, note.body ?? '')))
      if (!isDoc(target) && existsSync(join(entriesDir, target)) && statSync(join(entriesDir, target)).isFile()) add(target, 'file').file.usedIn.push({ name: rel.split('/').pop()!, url: noteUrl(rel) });
  }
  const sort = (dir: TreeFolder) => { dir.children.sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)); dir.children.forEach(c => c.kind === 'folder' && sort(c)); };
  sort(root);
  return root;
}
export const treeFolders = (dir: TreeFolder): TreeFolder[] => [dir, ...dir.children.flatMap(c => c.kind === 'folder' ? treeFolders(c) : [])];
export const treeAttachments = (dir: TreeFolder): TreeFile[] => treeFolders(dir).flatMap(d => d.children.filter((c): c is TreeFile => c.kind === 'file'));
