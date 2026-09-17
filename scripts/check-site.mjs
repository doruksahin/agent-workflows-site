import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
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
let links=0;
const files=walk(root).filter(p=>p.endsWith('.html')&&!p.includes('/maps/'));
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
const authored=[...walk('src'),...walk('content')].filter(p=>/\.(json|md|astro)$/.test(p));
for(const file of authored) assert.ok(!readFileSync(file,'utf8').includes('/Users/'),'Personal filesystem path in '+file);
console.log('Verified '+files.length+' pages, '+links+' local links, '+tools.length+' source records, and the standalone map checksum.');
