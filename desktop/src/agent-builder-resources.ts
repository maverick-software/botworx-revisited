/** Public catalog summaries only. Credentials, URLs and execution grants never enter builder context. */
export type BuilderResource={id:string;name:string;description:string;digest?:string;enabled:boolean;configured:boolean;assigned:boolean};
export type BuilderResources={revision:number|null;apps:BuilderResource[];skills:BuilderResource[]};
export type BuilderResourceKind='apps'|'skills';
const idPattern=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/;
const record=(raw:unknown,keys:string[])=>{if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!keys.includes(key)))throw Error('The builder resource catalog contains unsupported fields.');return raw as Record<string,unknown>;};
const text=(raw:unknown,max:number)=>{if(typeof raw!=='string'||raw.length>max||raw.includes('\0'))throw Error('The builder resource catalog exceeds its text limits.');return raw;};
export function builderResourceIds(raw:unknown):string[]{
 if(!Array.isArray(raw)||raw.length>500||raw.some(id=>typeof id!=='string'||!idPattern.test(id))||new Set(raw).size!==raw.length)throw Error('Choose distinct app or skill identifiers from the available catalog.');
 return [...raw];
}
export function builderResources(raw:unknown):BuilderResources{
 const value=record(raw,['revision','apps','skills']);
 if(value.revision!==null&&(!Number.isSafeInteger(value.revision)||Number(value.revision)<1))throw Error('The builder resource revision is invalid.');
 if(!Array.isArray(value.apps)||!Array.isArray(value.skills)||value.apps.length+value.skills.length>500)throw Error('Use at most 500 builder catalog entries.');
 const entries=(rows:unknown[]):BuilderResource[]=>{
  const result=rows.map(raw=>{
   const row=record(raw,['id','name','description','digest','enabled','configured','assigned']),id=text(row.id,200),name=text(row.name,100),description=text(row.description,1000);
   if(!idPattern.test(id)||!name.trim()||['enabled','configured','assigned'].some(key=>typeof row[key]!=='boolean')||row.digest!==undefined&&(typeof row.digest!=='string'||!/^[a-f0-9]{64}$/.test(row.digest)))throw Error('The builder resource catalog entry is invalid.');
   return {id,name,description,...(row.digest===undefined?{}:{digest:row.digest as string}),enabled:row.enabled as boolean,configured:row.configured as boolean,assigned:row.assigned as boolean};
  });
  if(new Set(result.map(row=>row.id)).size!==result.length)throw Error('Builder catalog identifiers must be unique.');return result;
 };
 return {revision:value.revision as number|null,apps:entries(value.apps),skills:entries(value.skills)};
}
export function builderResourceSelection(resources:BuilderResources,kind:BuilderResourceKind):string[]{return resources[kind].filter(row=>row.assigned).map(row=>row.id).sort();}
/** Compare the captured inventory separately from the selected desired inventory. */
function inventory(resources:BuilderResources):string{
 const rows=(kind:BuilderResourceKind)=>resources[kind].map(({assigned,...row})=>row).sort((a,b)=>a.id.localeCompare(b.id));
 return JSON.stringify({revision:resources.revision,apps:rows('apps'),skills:rows('skills')});
}
export function applyBuilderResourceSelection(current:BuilderResources|undefined,basis:BuilderResources|undefined,kind:BuilderResourceKind,ids:string[]):BuilderResources{
 if(!current||!basis)throw Error('Reload the available app and skill catalog before applying these changes.');
 const checked=builderResources(current),captured=builderResources(basis),selection=builderResourceIds(ids);
 if(inventory(checked)!==inventory(captured)||JSON.stringify(builderResourceSelection(checked,kind))!==JSON.stringify(builderResourceSelection(captured,kind)))throw Error('The app or skill catalog changed after this request. Ask the builder to use the current draft before applying it.');
 for(const id of selection){
  const original=captured[kind].find(row=>row.id===id),available=checked[kind].find(row=>row.id===id);
  if(!original||!available||!(available.enabled&&available.configured)&&!(original.assigned&&available.assigned))throw Error('The proposed app or skill is unavailable in this account catalog.');
 }
 const selected=new Set(selection);return {...checked,[kind]:checked[kind].map(row=>({...row,assigned:selected.has(row.id)}))};
}
