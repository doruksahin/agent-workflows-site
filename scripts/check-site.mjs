import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { loadRules, scanText } from './disclosure.mjs';
const root=resolve('dist');
const walk=dir=>readdirSync(dir).flatMap(n=>{const p=join(dir,n);return statSync(p).isDirectory()?walk(p):[p]});
const tools=JSON.parse(readFileSync('src/data/tools.json','utf8'));
const slugs=new Set(tools.map(t=>t.slug));
assert.equal(slugs.size,tools.length,'Duplicate tool slug');
for(const tool of tools){
 assert.match(tool.commit,/^[0-9a-f]{40}$/,'Source requires full commit');
 assert.equal(typeof tool.public,'boolean','Source visibility required');
 assert.ok(tool.files.length,'Source files required');
 for(const related of tool.related) assert.ok(slugs.has(related),'Unknown related tool: '+related);
}
const notesDir='src/content/notes';
const frontmatter=file=>(readFileSync(file,'utf8').match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/)||[,''])[1];
const notes=existsSync(notesDir)?readdirSync(notesDir).flatMap(slug=>{const files=['index.mdx','index.md'].map(n=>join(notesDir,slug,n)).filter(existsSync);assert.ok(files.length<=1,'Note has both index.md and index.mdx: '+slug);const file=files[0];return file?[{slug,draft:/^draft:\s*true\s*(#.*)?\r?$/mi.test(frontmatter(file))}]:[]}):[];
const published=notes.filter(n=>!n.draft);
for(const n of notes) assert.ok(!['tags','rss.xml'].includes(n.slug),'Reserved note slug: '+n.slug);
for(const n of notes) assert.match(n.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'Note slug must be kebab-case: '+n.slug);
assert.ok(existsSync(join(root,'notes/index.html')),'Missing notes index');
const notesIndex=readFileSync(join(root,'notes/index.html'),'utf8');
for(const n of published) assert.ok(notesIndex.includes('href="/notes/'+n.slug+'/"'),'Notes index omits '+n.slug);
for(const n of published) assert.ok(existsSync(join(root,'notes',n.slug,'index.html')),'Missing note page '+n.slug);
for(const n of notes.filter(n=>n.draft)) assert.ok(!existsSync(join(root,'notes',n.slug)),'Draft note was built: '+n.slug);
const feed=readFileSync(join(root,'notes/rss.xml'),'utf8');
const sitemap=readFileSync(join(root,'sitemap.xml'),'utf8');
for(const n of published){const url='https://workflows.doruk.uk/notes/'+n.slug+'/';assert.ok(feed.includes(url),'RSS omits '+n.slug);assert.ok(sitemap.includes('<loc>'+url+'</loc>'),'Sitemap omits '+n.slug)}
assert.ok(sitemap.includes('<loc>https://workflows.doruk.uk/notes/</loc>'),'Sitemap omits notes index');
for(const n of notes.filter(n=>n.draft)){const path='/notes/'+n.slug+'/';assert.ok(!feed.includes(path),'RSS includes draft '+n.slug);assert.ok(!sitemap.includes(path),'Sitemap includes draft '+n.slug)}
const tagsDir=join(root,'notes/tags');
for(const tag of existsSync(tagsDir)?readdirSync(tagsDir).filter(t=>statSync(join(tagsDir,t)).isDirectory()):[]) assert.ok(sitemap.includes('<loc>https://workflows.doruk.uk/notes/tags/'+tag+'/</loc>'),'Sitemap omits tag page '+tag);
let links=0;
const files=walk(root).filter(p=>p.endsWith('.html')&&!p.includes('/maps/')&&!p.includes('/downloads/'));
const refs=walk(root).filter(p=>/\.(html|css|xml|js)$/.test(p)).map(p=>readFileSync(p,'utf8')).join('\n');
const assets=existsSync(join(root,'_astro'))?readdirSync(join(root,'_astro')):[];
const referenced=a=>refs.includes('/_astro/'+a);
// Astro also emits an unreferenced original beside each transformed SVG: x.HASH.svg next to x.HASH_HASH2.svg.
const transformedSibling=a=>{const ext=a.match(/\.[^.]+$/)?.[0]??'',stem=a.slice(0,a.length-ext.length);return assets.some(b=>b!==a&&b.startsWith(stem+'_')&&b.endsWith(ext)&&referenced(b))};
for(const a of assets) assert.ok(referenced(a)||transformedSibling(a),'Unreferenced build asset (draft attachment?) '+a);
for(const file of files){
 const html=readFileSync(file,'utf8');
 assert.ok(html.includes('<title>'),'Missing page title: '+file);
 assert.ok(html.includes('name="description"'),'Missing description: '+file);
 for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  const href=m[1].replaceAll('&amp;','&');
  if(!href.startsWith('/')||href.startsWith('//')) continue;
  const path=decodeURIComponent(href.split(/[?#]/)[0]);
  const target=join(root,path);
  assert.ok(existsSync(target),'Missing local target '+href+' in '+file);
  if(statSync(target).isDirectory()) assert.ok(existsSync(join(target,'index.html')),'Missing page '+href);
  links++;
 }
}
const manifest=JSON.parse(readFileSync('content/maps/provenance.json','utf8'));
const hash=createHash('sha256').update(readFileSync(manifest.html)).digest('hex');
assert.equal(hash,manifest.sha256,'Map differs from reviewed artifact');
assert.equal(createHash('sha256').update(readFileSync('dist/downloads/agent-workflows.html')).digest('hex'),manifest.sha256,'Download differs from original map');
const authored=[...walk('src'),...walk('content')].filter(p=>/\.(json|mdx?|astro)$/.test(p));
for(const file of authored) assert.ok(!readFileSync(file,'utf8').includes('/Users/'),'Personal filesystem path in '+file);
const rules=loadRules(new URL('./disclosure-rules.json',import.meta.url));
const disclosed=(existsSync(notesDir)?walk(notesDir).filter(p=>/\.(mdx?|mmd|svg|json)$/.test(p)):[]).flatMap(file=>scanText(readFileSync(file,'utf8'),rules).map(f=>f.id+' '+file+':'+f.line+' ('+f.match+')'));
assert.ok(!disclosed.length,'Disclosure findings:\n'+disclosed.join('\n'));
console.log('Verified '+files.length+' pages, '+links+' local links, '+tools.length+' source records, and the standalone map checksum.');
