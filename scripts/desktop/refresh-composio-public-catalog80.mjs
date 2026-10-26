// Refresh the public provider-published service metadata. No account or token is used.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const source='https://docs.composio.dev/toolkits',response=await fetch(source,{signal:AbortSignal.timeout(30000)});assert(response.ok);const html=await response.text();assert(html.length<8*1024*1024);
const decode=text=>text.replace(/&#(?:x([a-f\d]+)|(\d+));|&(amp|quot|apos|lt|gt);/gi,(_,hex,decimal,name)=>hex||decimal?String.fromCodePoint(parseInt(hex??decimal,hex?16:10)):({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}[name.toLowerCase()]));
const items=[];
for(const match of html.matchAll(/<a\b[^>]*href="\/toolkits\/([a-z0-9_]+)"[^>]*>([\s\S]*?)<\/a>/g)){
 const slug=match[1],body=match[2],name=body.match(/<span class="truncate text-sm font-medium[^\"]*">([^<]+)<\/span>/)?.[1],counts=[...body.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map(value=>value[1].replace(/<[^>]*>/g,'').trim()).slice(-2);
 if(!name||counts.length!==2||counts.some(value=>!/^\d[\d,]*$/.test(value)))continue;
 const item={slug,name:decode(name),toolCount:Number(counts[0].replaceAll(',','')),triggerCount:Number(counts[1].replaceAll(',',''))},prior=items.find(item=>item.slug===slug);if(prior)assert.deepEqual(prior,item,'Conflicting provider service metadata');else items.push(item);
}
assert(items.length>1000&&items.length<5000);for(const slug of ['gmail','quickbooks'])assert(items.find(item=>item.slug===slug)?.toolCount>0);items.sort((a,b)=>a.name.localeCompare(b.name));
const provenance={source,updatedAt:new Date().toISOString(),sourceSha256:createHash('sha256').update(html).digest('hex'),count:items.length};
await writeFile(path.resolve(import.meta.dirname,'../../desktop/src/composio-service-catalog.ts'),'// Provider-published potential services; connection status is read separately from the owned account.\nexport const composioCatalogProvenance='+JSON.stringify(provenance)+' as const;\nexport const composioPublicServices='+JSON.stringify(items)+' as const;\n');console.log(JSON.stringify({success:true,...provenance}));
