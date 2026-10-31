export function parseComposioPublicCatalog(html:string){
 if(html.length>8*1024*1024)throw Error('The public Composio catalog exceeds its size limit.');
 const decode=(text:string)=>text.replace(/&#(?:x([a-f\d]+)|(\d+));|&(amp|quot|apos|lt|gt);/gi,(_,hex,decimal,name)=>hex||decimal?String.fromCodePoint(parseInt(hex??decimal,hex?16:10)):({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'} as Record<string,string>)[name.toLowerCase()]);
 const items:Array<{slug:string;name:string;toolCount:number;triggerCount:number}>=[];
 for(const match of html.matchAll(/<a\b[^>]*href="\/toolkits\/([a-z0-9_]+)"[^>]*>([\s\S]*?)<\/a>/g)){
  const slug=match[1],body=match[2],name=body.match(/<span class="truncate text-sm font-medium[^\"]*">([^<]+)<\/span>/)?.[1],counts=[...body.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map(value=>value[1].replace(/<[^>]*>/g,'').trim()).slice(-2);
  if(!name||counts.length!==2||counts.some(value=>!/^\d[\d,]*$/.test(value)))continue;const item={slug,name:decode(name),toolCount:Number(counts[0].replaceAll(',','')),triggerCount:Number(counts[1].replaceAll(',',''))},prior=items.find(item=>item.slug===slug);if(prior){if(JSON.stringify(prior)!==JSON.stringify(item))throw Error('The provider returned conflicting service metadata.');}else items.push(item);
 }
 if(items.length<1000||items.length>5000||!items.some(row=>row.slug==='gmail'&&row.toolCount>0)||!items.some(row=>row.slug==='quickbooks'&&row.toolCount>0))throw Error('The provider public catalog format changed. The saved catalog is retained.');
 return items.sort((a,b)=>a.name.localeCompare(b.name));
}
