import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { noteId, noteUrl, folderUrl, pathErrors, urlCollisions, relativeTargets, linkedFiles } from './note-paths.mjs';
import noteLinks from './note-links.mjs';

test('maps source paths to IDs and URLs, with a README as its folder', () => {
  assert.equal(noteId('observability/README.mdx'), 'observability');
  assert.equal(noteId('observability/diagnose-with-cli.md'), 'observability/diagnose-with-cli');
  assert.equal(noteId('a/b/README.md'), 'a/b');
  assert.equal(noteUrl('observability/README.md'), '/notes/observability/');
  assert.equal(noteUrl('observability/diagnose-with-cli.md'), '/notes/observability/diagnose-with-cli/');
  assert.equal(noteUrl('observability/images/02-trace-tree.jpg'), '/notes/observability/images/02-trace-tree.jpg');
  assert.equal(folderUrl('observability/images'), '/notes/observability/images/');
  assert.equal(folderUrl(''), '/notes/');
});
test('rejects unsafe segments, a root README, and reserved root names', () => {
  assert.deepEqual(pathErrors('observability/diagnose-with-cli.md'), []);
  assert.match(pathErrors('x/Bad Name.md').join(), /Unsafe path segment "Bad Name.md"/);
  assert.match(pathErrors('README.md').join(), /README at the notes root/);
  assert.match(pathErrors('tags/x.md').join(), /Reserved root name "tags"/);
  assert.match(pathErrors('tags.md').join(), /Reserved root name "tags"/);
  assert.match(pathErrors('rss.xml').join(), /Reserved root name "rss.xml"/);
});
test('reports sources that share a URL', () => {
  assert.deepEqual(urlCollisions(['a/README.md', 'a/b.md', 'a/images/x.jpg']), []);
  assert.match(urlCollisions(['a/README.md', 'a/README.mdx']).join(), /\/notes\/a\/ .*a\/README.md.*a\/README.mdx/);
  assert.match(urlCollisions(['x.md', 'x/y.md']).join(), /\/notes\/x\/ .*x.md.*x\//);
  assert.match(urlCollisions(['a/x.jpg', 'a/x.jpg.md']).join(), /\/notes\/a\/x.jpg/);
});
test('finds relative link, image, definition, and src targets outside code', () => {
  const body = '[a](b.md#s) ![i](./images/x.jpg "t") [ext](https://e.com) [h](#top) [m](mailto:a@b.c)\n[ref]: ../c.md\n<img src="./y.png" />\n`[no](code.md)`\n```\n[no](fenced.md)\n```\n[abs](/notes/)';
  assert.deepEqual(relativeTargets(body), ['b.md#s', './images/x.jpg', '../c.md', './y.png']);
  assert.deepEqual(linkedFiles('o/README.md', body), ['o/b.md', 'o/images/x.jpg', 'c.md', 'o/y.png']);
  assert.deepEqual(linkedFiles('README.md', '[x](../../outside.md)'), []);
});

const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 'notes-'));
  mkdirSync(join(dir, 'o/images'), { recursive: true });
  for (const f of ['o/README.md', 'o/cli.md', 'o/images/x.jpg']) writeFileSync(join(dir, f), '');
  return dir;
};
const ctx = { setProperty: (node, key, value) => { node[key] = value } };
const plugin = (dir, from) => noteLinks({ notesDir: dir })({ fileURL: pathToFileURL(join(dir, from)) });
const rewrite = (dir, from, urls) => urls.map(url => { const node = { type: 'link', url, children: [] }; plugin(dir, from).link(node, ctx); return node.url });
test('rewrites relative links to pages, folders, and attachments; leaves images and absolute links', () => {
  const dir = fixture();
  try {
    assert.deepEqual(rewrite(dir, 'o/README.md', ['cli.md#step-2', './README.md', 'images/x.jpg', 'images/', 'https://e.com/a.md', '#top', 'mailto:a@b.c', '/notes/']),
      ['/notes/o/cli/#step-2', '/notes/o/', '/notes/o/images/x.jpg', '/notes/o/images/', 'https://e.com/a.md', '#top', 'mailto:a@b.c', '/notes/']);
    const def = { type: 'definition', url: 'cli.md' };
    plugin(dir, 'o/README.md').definition(def, ctx);
    assert.equal(def.url, '/notes/o/cli/');
    assert.equal(plugin(dir, 'o/README.md').image, undefined, 'images stay with the Astro image pipeline');
  } finally { rmSync(dir, { recursive: true, force: true }) }
});
test('fails on missing targets and targets outside the notes folder; skips other files', () => {
  const dir = fixture();
  try {
    assert.throws(() => rewrite(dir, 'o/cli.md', ['missing.md']), /o\/cli.md: link "missing.md" points to a missing file/);
    assert.throws(() => rewrite(dir, 'o/cli.md', ['../../outside.md']), /o\/cli.md: link "..\/..\/outside.md" points outside src\/content\/notes\//);
    assert.equal(plugin(dir, '../elsewhere.md'), null);
    assert.equal(noteLinks({ notesDir: dir })({ fileURL: undefined }), null);
  } finally { rmSync(dir, { recursive: true, force: true }) }
});
