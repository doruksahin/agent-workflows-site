import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { noteId, noteUrl, folderUrl, viewUrl, isImage, pathErrors, urlCollisions, relativeTargets, linkedFiles } from './note-paths.mjs';
import noteLinks, { noteImages } from './note-links.mjs';

test('maps source paths to IDs and URLs, with a README as an ordinary note', () => {
  assert.equal(noteId('observability/README.mdx'), 'observability/README');
  assert.equal(noteId('observability/diagnose-with-cli.md'), 'observability/diagnose-with-cli');
  assert.equal(noteId('a/b/README.md'), 'a/b/README');
  assert.equal(noteUrl('observability/README.md'), '/knowledge-base/observability/README/');
  assert.equal(noteUrl('observability/diagnose-with-cli.md'), '/knowledge-base/observability/diagnose-with-cli/');
  assert.equal(noteUrl('observability/images/02-trace-tree.jpg'), '/knowledge-base/observability/images/02-trace-tree.jpg');
  assert.equal(folderUrl('observability/images'), '/knowledge-base/observability/images/');
  assert.equal(folderUrl(''), '/knowledge-base/');
});
test('links an image to its folder gallery, and other files to their page or raw URL', () => {
  assert.ok(['a.jpg', 'a.png', 'a.gif', 'a.webp', 'a.svg'].every(isImage));
  assert.ok(!['a.pdf', 'a.mmd', 'a.md', 'a.jpeg'].some(isImage), 'only extensions with a raw route are images');
  assert.equal(viewUrl('observability/images/02-trace-tree.jpg'), '/knowledge-base/observability/images/#02-trace-tree.jpg');
  assert.equal(viewUrl('x.svg'), '/knowledge-base/x.svg', 'the knowledge base index has no gallery');
  assert.equal(viewUrl('observability/files/report.pdf'), '/knowledge-base/observability/files/report.pdf');
  assert.equal(viewUrl('observability/diagnose-with-cli.md'), '/knowledge-base/observability/diagnose-with-cli/');
});
test('rejects unsafe segments and reserved root names', () => {
  assert.deepEqual(pathErrors('observability/diagnose-with-cli.md'), []);
  assert.match(pathErrors('x/Bad Name.md').join(), /Unsafe path segment "Bad Name.md"/);
  assert.deepEqual(pathErrors('README.md'), []);
  assert.match(pathErrors('tags/x.md').join(), /Reserved root name "tags"/);
  assert.match(pathErrors('tags.md').join(), /Reserved root name "tags"/);
  assert.match(pathErrors('rss.xml').join(), /Reserved root name "rss.xml"/);
});
test('reports sources that share a URL', () => {
  assert.deepEqual(urlCollisions(['a/README.md', 'a/b.md', 'a/images/x.jpg']), []);
  assert.match(urlCollisions(['a/README.md', 'a/README.mdx']).join(), /\/knowledge-base\/a\/README\/ .*a\/README.md.*a\/README.mdx/);
  assert.match(urlCollisions(['x.md', 'x/y.md']).join(), /\/knowledge-base\/x\/ .*x.md.*x\//);
  assert.match(urlCollisions(['a/x.jpg', 'a/x.jpg.md']).join(), /\/knowledge-base\/a\/x.jpg/);
});
test('finds relative Markdown link, image, and definition targets outside code; not raw HTML', () => {
  const body = '[a](b.md#s) ![i](./images/x.jpg "t") [ext](https://e.com) [h](#top) [m](mailto:a@b.c)\n[ref]: ../c.md\n<img src="./y.png" /> <a href="z.md">z</a>\n`[no](code.md)`\n```\n[no](fenced.md)\n```\n[abs](/knowledge-base/)';
  assert.deepEqual(relativeTargets(body), ['b.md#s', './images/x.jpg', '../c.md'], 'raw HTML is not rewritten, so it is not a publishing reference; check-site rejects it in the built page');
  assert.deepEqual(linkedFiles('o/README.md', body), ['o/b.md', 'o/images/x.jpg', 'c.md']);
  assert.deepEqual(linkedFiles('README.md', '[x](../../outside.md)'), []);
});
test('does not read GFM footnote definitions as link definitions', () => {
  assert.deepEqual(relativeTargets('Text.[^1]\n\n[^1]: See the notes.\n   [^note]: Indented.\n[ref]: x.md'), ['x.md']);
});

const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-'));
  mkdirSync(join(dir, 'o/images'), { recursive: true });
  for (const f of ['o/README.md', 'o/cli.md', 'o/images/x.jpg']) writeFileSync(join(dir, f), '');
  return dir;
};
const ctx = { setProperty: (node, key, value) => { node[key] = value } };
const plugin = (dir, from) => noteLinks({ entriesDir: dir })({ fileURL: pathToFileURL(join(dir, from)) });
const rewrite = (dir, from, urls) => urls.map(url => { const node = { type: 'link', url, children: [] }; plugin(dir, from).link(node, ctx); return node.url });
test('rewrites relative links to pages, folders, and attachments; leaves images and absolute links', () => {
  const dir = fixture();
  try {
    assert.deepEqual(rewrite(dir, 'o/README.md', ['cli.md#step-2', './README.md', 'images/x.jpg', 'images/', 'https://e.com/a.md', '#top', 'mailto:a@b.c', '/knowledge-base/']),
      ['/knowledge-base/o/cli/#step-2', '/knowledge-base/o/README/', '/knowledge-base/o/images/x.jpg', '/knowledge-base/o/images/', 'https://e.com/a.md', '#top', 'mailto:a@b.c', '/knowledge-base/']);
    const def = { type: 'definition', url: 'cli.md' };
    plugin(dir, 'o/README.md').definition(def, ctx);
    assert.equal(def.url, '/knowledge-base/o/cli/');
    assert.equal(plugin(dir, 'o/README.md').image, undefined, 'images stay with the Astro image pipeline');
  } finally { rmSync(dir, { recursive: true, force: true }) }
});
test('fails on missing targets and targets outside the knowledge base folder; skips other files', () => {
  const dir = fixture();
  try {
    assert.throws(() => rewrite(dir, 'o/cli.md', ['missing.md']), /o\/cli.md: link "missing.md" points to a missing file/);
    assert.throws(() => rewrite(dir, 'o/cli.md', ['../../outside.md']), /o\/cli.md: link "..\/..\/outside.md" points outside src\/content\/knowledge-base\//);
    assert.equal(plugin(dir, '../elsewhere.md'), null);
    assert.equal(noteLinks({ entriesDir: dir })({ fileURL: undefined }), null);
  } finally { rmSync(dir, { recursive: true, force: true }) }
});
test('marks relative note images with their raw attachment URL for the viewer', () => {
  const dir = fixture();
  try {
    const images = from => noteImages({ entriesDir: dir })({ fileURL: pathToFileURL(join(dir, from)) });
    const mark = (from, src) => { const node = { type: 'element', tagName: 'img', properties: { src } }; images(from).element.visit(node, ctx); return node['data-raw'] };
    assert.deepEqual(images('o/cli.md').element.filter, ['img']);
    assert.equal(mark('o/cli.md', './images/x.jpg'), '/knowledge-base/o/images/x.jpg');
    assert.equal(mark('o/README.md', 'images/x.jpg'), '/knowledge-base/o/images/x.jpg');
    assert.equal(mark('o/cli.md', 'https://e.com/x.jpg'), undefined);
    assert.equal(mark('o/cli.md', '/favicon.svg'), undefined);
    assert.equal(mark('o/cli.md', '../../outside.jpg'), undefined);
    assert.equal(noteImages({ entriesDir: dir })({ fileURL: pathToFileURL(join(dir, '../elsewhere.md')) }), null);
  } finally { rmSync(dir, { recursive: true, force: true }) }
});
