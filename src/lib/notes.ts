import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { folderUrl, isDoc, isReadme, linkedFiles, noteUrl } from '../../scripts/note-paths.mjs';

export type Note = CollectionEntry<'notes'>;
export const notesDir = 'src/content/notes';
export async function publishedNotes(): Promise<Note[]> {
  const notes = await getCollection('notes', ({ data }) => import.meta.env.DEV || !data.draft);
  return notes.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id));
}
export const noteTags = (notes: Note[]) => [...new Set(notes.flatMap(n => n.data.tags))].sort();
export const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
/** Source path under src/content/notes/, such as observability/README.mdx. */
export const noteSource = (note: Note) => note.filePath!.slice(notesDir.length + 1);
export const notePath = (note: Note) => noteUrl(noteSource(note));
export const noteFolder = (note: Note) => noteSource(note).split('/').slice(0, -1).join('/');

export type TreeFile = { kind: 'doc' | 'file'; name: string; rel: string; url: string; note?: Note };
export type TreeFolder = { kind: 'folder'; name: string; rel: string; url: string; children: (TreeFolder | TreeFile)[]; readme?: Note };
/** Published Markdown files plus the attachments they link to or embed, as source-named folders. */
export function noteTree(notes: Note[]): TreeFolder {
  const root: TreeFolder = { kind: 'folder', name: 'notes', rel: '', url: folderUrl(''), children: [] };
  const folder = (rel: string): TreeFolder => rel.split('/').reduce((dir, name, i, parts) => {
    const path = parts.slice(0, i + 1).join('/');
    let next = dir.children.find((c): c is TreeFolder => c.kind === 'folder' && c.name === name);
    if (!next) dir.children.push(next = { kind: 'folder', name, rel: path, url: folderUrl(path), children: [] });
    return next;
  }, root);
  const add = (rel: string, file: TreeFile) => { const dir = rel.includes('/') ? folder(rel.slice(0, rel.lastIndexOf('/'))) : root; if (!dir.children.some(c => c.rel === rel)) dir.children.push(file); return dir; };
  for (const note of notes) {
    const rel = noteSource(note);
    const dir = add(rel, { kind: 'doc', name: rel.split('/').pop()!, rel, url: noteUrl(rel), note });
    if (isReadme(rel)) dir.readme = note;
    for (const target of linkedFiles(rel, note.body ?? ''))
      if (!isDoc(target) && existsSync(join(notesDir, target)) && statSync(join(notesDir, target)).isFile()) add(target, { kind: 'file', name: target.split('/').pop()!, rel: target, url: noteUrl(target) });
  }
  const sort = (dir: TreeFolder) => { dir.children.sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)); dir.children.forEach(c => c.kind === 'folder' && sort(c)); };
  sort(root);
  return root;
}
export const treeFolders = (dir: TreeFolder): TreeFolder[] => [dir, ...dir.children.flatMap(c => c.kind === 'folder' ? treeFolders(c) : [])];
export const treeAttachments = (dir: TreeFolder): TreeFile[] => treeFolders(dir).flatMap(d => d.children.filter((c): c is TreeFile => c.kind === 'file'));
