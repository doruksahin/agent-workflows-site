import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, relative, sep } from 'node:path';
import assert from 'node:assert/strict';
import { loadRules, scanText } from './disclosure.mjs';
import { noteId, noteUrl, folderUrl, isDoc, isReadme, pathErrors, urlCollisions, linkedFiles, relativeTargets, resolveTarget } from './note-paths.mjs';
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
const site='https://workflows.doruk.uk';
const frontmatter=text=>(text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/)||[,''])[1];
const sources=existsSync(notesDir)?walk(notesDir).map(p=>relative(notesDir,p).split(sep).join('/')).filter(r=>!r.split('/').some(s=>s.startsWith('.'))).sort():[];
const sourceErrors=[...sources.flatMap(pathErrors),...urlCollisions(sources)];
assert.ok(!sourceErrors.length,'Note source errors:\n'+sourceErrors.join('\n'));
const docs=sources.filter(isDoc).map(rel=>{const text=readFileSync(join(notesDir,rel),'utf8'),fm=frontmatter(text);return {rel,id:noteId(rel),url:noteUrl(rel),readme:isReadme(rel),draft:/^draft:\s*true\s*(#.*)?\r?$/mi.test(fm),body:text.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---/,'')}});
const published=docs.filter(d=>!d.draft),drafts=docs.filter(d=>d.draft);
const brokenLinks=published.flatMap(d=>relativeTargets(d.body).map(t=>[t,resolveTarget(d.rel,t)]).filter(([,r])=>r.outside||!existsSync(join(notesDir,r.rel))).map(([t,r])=>d.rel+': link "'+t+'" '+(r.outside?'points outside src/content/notes/':'points to a missing file')));
assert.ok(!brokenLinks.length,'Broken note links:\n'+brokenLinks.join('\n'));
const attachments=new Set(published.flatMap(d=>linkedFiles(d.rel,d.body)).filter(r=>!isDoc(r)&&sources.includes(r)));
const dirsOf=rel=>rel.split('/').slice(0,-1).map((_,i,a)=>a.slice(0,i+1).join('/'));
const folders=new Set([...published.map(d=>d.rel),...attachments].flatMap(dirsOf));
assert.ok(existsSync(join(root,'notes/index.html')),'Missing notes index');
const notesIndex=readFileSync(join(root,'notes/index.html'),'utf8');
const feed=readFileSync(join(root,'notes/rss.xml'),'utf8');
const sitemap=readFileSync(join(root,'sitemap.xml'),'utf8');
const inSitemap=path=>sitemap.includes('<loc>'+site+path+'</loc>');
const distTexts=walk(root).filter(p=>/\.(html|xml)$/.test(p)).map(p=>readFileSync(p,'utf8'));
const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const mentioned=url=>{const re=new RegExp('[">](?:'+escapeRe(site)+')?'+escapeRe(url)+'["<]');return distTexts.some(t=>re.test(t))};
for(const d of published){
 assert.ok(notesIndex.includes('data-note="'+d.id+'"'),'Notes index (Latest) omits '+d.rel);
 assert.ok(notesIndex.includes('href="'+d.url+'"'),'Notes index (Files) omits '+d.rel);
 assert.ok(existsSync(join(root,d.url,'index.html')),'Missing note page '+d.url+' for '+d.rel);
 assert.ok(feed.includes('<link>'+site+d.url+'</link>'),'RSS omits '+d.rel);
 assert.ok(inSitemap(d.url),'Sitemap omits '+d.url);
}
for(const dir of folders){const url=folderUrl(dir);assert.ok(existsSync(join(root,url,'index.html')),'Missing folder page '+url);assert.ok(inSitemap(url),'Sitemap omits folder page '+url)}
for(const rel of sources.filter(r=>!isDoc(r))){
 const built=join(root,'notes',rel);
 if(attachments.has(rel)){assert.ok(existsSync(built),'Missing attachment '+noteUrl(rel)+' (each extension needs src/pages/notes/[...file].<ext>.ts)');assert.ok(readFileSync(built).equals(readFileSync(join(notesDir,rel))),'Attachment differs from source: '+rel);assert.ok(notesIndex.includes('href="'+noteUrl(rel)+'"'),'Notes index (Files) omits attachment '+rel)}
 else assert.ok(!existsSync(built),'Unpublished attachment was built: '+rel);
}
for(const d of drafts){
 assert.ok(!distTexts.some(t=>t.includes('data-note="'+d.id+'"')),'Draft listed: '+d.rel);
 assert.ok(!feed.includes(site+d.url+'<'),'RSS includes draft '+d.rel);
 if(d.readme&&folders.has(d.id)) assert.ok(!readFileSync(join(root,d.url,'index.html'),'utf8').includes('data-readme'),'Folder page renders draft README '+d.rel);
 else{assert.ok(!existsSync(join(root,d.url)),'Draft note was built: '+d.rel);assert.ok(!mentioned(d.url),'Draft URL is linked or listed: '+d.url)}
}
for(const dir of new Set(sources.flatMap(dirsOf))) if(!folders.has(dir)){const url=folderUrl(dir);assert.ok(!existsSync(join(root,url)),'Unpublished folder was built: '+url);assert.ok(!mentioned(url),'Unpublished folder is linked or listed: '+url)}
assert.ok(inSitemap('/notes/'),'Sitemap omits notes index');
for(const page of walk(root).filter(p=>p.endsWith('.html')&&!/\/(maps|downloads)\//.test(p)&&!p.endsWith('/404.html'))){const path='/'+relative(root,page).split(sep).join('/').replace(/index\.html$/,'');assert.ok(inSitemap(path),'Sitemap omits page '+path)}
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
