import { readFileSync } from 'node:fs';
export const loadRules=path=>JSON.parse(readFileSync(path,'utf8')).map(r=>({id:r.id,re:new RegExp(r.pattern,'g'+(r.flags??'').replace('g',''))}));
export function scanText(text,rules){
 const findings=[];
 text.split('\n').forEach((line,i)=>{for(const r of rules) for(const m of line.matchAll(r.re)) findings.push({id:r.id,line:i+1,match:m[0]})});
 return findings;
}
