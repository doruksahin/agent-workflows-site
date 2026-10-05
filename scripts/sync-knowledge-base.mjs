// Copies private source folders into src/content/knowledge-base/ as they are, with private details redacted.
// Usage: pnpm sync:kb [folder ...]   (default: every folder in scripts/knowledge-base-sources.json)
// The sources are local checkouts of private repositories, so this runs on a workstation, not in CI. Commit
// the output; review it before you push. Images are copied unchanged, and Markdown bodies are copied as
// they are apart from redaction and unlinking.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, posix, relative, resolve, sep } from 'node:path';
import { loadRules, scanText } from './disclosure.mjs';
import { liftLead, redactJson, redactText, takeTitle, unlinkPrivate } from './redact.mjs';

const rules = loadRules(new URL('./disclosure-rules.json', import.meta.url));
const sources = JSON.parse(readFileSync(new URL('./knowledge-base-sources.json', import.meta.url), 'utf8'));
const entriesDir = resolve('src/content/knowledge-base');
const walk = dir => readdirSync(dir).filter(n => !n.startsWith('.')).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const yaml = v => JSON.stringify(v);

function gitDates(file) {
  const dates = git(dirname(file), 'log', '--follow', '--format=%as', '--', basename(file)).split('\n').filter(Boolean);
  if (!dates.length) throw new Error(`${file} has no commits: commit it in its source repository first`);
  return { date: dates.at(-1), updated: dates[0] !== dates.at(-1) ? dates[0] : undefined };
}

function syncMarkdown(src, rel, dest, cfg) {
  const source = readFileSync(src, 'utf8');
  const { title, body } = takeTitle(source);
  if (!title) throw new Error(`${src} needs a leading "# Title"`);
  const leavesFolder = url => !/^(?:[a-z][a-z0-9+.-]*:|[#/?])/i.test(url) && posix.normalize(posix.join(posix.dirname(rel), url.split(/[?#]/)[0])).startsWith('../');
  // The page shows this body exactly; title and summary only feed listings, the feed, and meta tags.
  const md = redactText(unlinkPrivate(source, rules, leavesFolder), rules);
  const summary = liftLead(redactText(body, rules)).lead ?? redactText(title, rules);
  const { date, updated } = gitDates(src);
  const fm = ['---', `title: ${yaml(redactText(title, rules))}`, `summary: ${yaml(summary)}`, `date: ${date}`, ...(updated ? [`updated: ${updated}`] : []),
    `tags: [${cfg.tags.join(', ')}]`, `source: ${yaml(cfg.note)}`, 'verbatim: true', '---', ''];
  writeFileSync(dest, fm.join('\n') + md);
}

const wanted = process.argv.slice(2);
for (const cfg of sources.filter(s => !wanted.length || wanted.includes(s.folder))) {
  const from = resolve(cfg.source.replace(/^~(?=\/)/, homedir()));
  const to = join(entriesDir, cfg.folder);
  rmSync(to, { recursive: true, force: true });
  for (const src of walk(from)) {
    const rel = relative(from, src).split(sep).join('/');
    const dest = join(to, rel);
    mkdirSync(dirname(dest), { recursive: true });
    if (/\.mdx?$/.test(rel)) syncMarkdown(src, rel, dest, cfg);
    else if (rel.endsWith('.json')) writeFileSync(dest, JSON.stringify(redactJson(JSON.parse(readFileSync(src, 'utf8')), rules), null, 2) + '\n');
    else if (/\.(?:mmd|svg|txt)$/.test(rel)) writeFileSync(dest, redactText(readFileSync(src, 'utf8'), rules));
    else copyFileSync(src, dest);
  }
  const left = walk(to).filter(p => /\.(?:mdx?|mmd|svg|json)$/.test(p)).flatMap(p => scanText(readFileSync(p, 'utf8'), rules).map(f => `${relative(entriesDir, p)}:${f.line} ${f.id}`));
  if (left.length) throw new Error('Unredacted matches remain:\n' + left.join('\n'));
  console.log(`Synced ${cfg.folder} from ${cfg.source}`);
}
