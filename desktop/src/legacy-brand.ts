// Compatibility is deliberately confined to reading retained product metadata.
// Historical content and original archives are never rewritten by these helpers.
export const legacyBrand = 'Agentopia';
export const legacySlug = 'agentopia';
export const legacyOrigin = legacySlug + '://app';
export const legacyPrivateFolder = '.' + legacySlug;
export function currentBrandKey(key:string){
 return key.startsWith(legacySlug+'.')?'sylvana'+key.slice(legacySlug.length):key;
}
export function currentBrandKind(kind:unknown){
 return typeof kind==='string'&&kind.startsWith(legacySlug+'-')?'sylvana'+kind.slice(legacySlug.length):kind;
}
export function currentFileHref(href:string){
 return new RegExp('^'+legacySlug+'-(?:file|chat):','i').test(href)?'sylvana'+href.slice(legacySlug.length):href;
}
export function legacyPrivateProfilePath(value:string){
 const normalized=value.replaceAll('/','\\').toLowerCase(),slug=legacySlug.toLowerCase();
 return normalized.includes('\\.'+slug+'\\desktop')||normalized.includes('\\'+slug+'-data\\profiles\\')||new RegExp('\\\\appdata\\\\(?:roaming|local\\\\packages\\\\[a-z0-9_.-]+\\\\localcache\\\\roaming)\\\\'+slug+'(?:-before-[a-f0-9-]{36})?(?:\\\\|$)').test(normalized)||new RegExp('\\\\\\.'+slug+'-recovery(?:-[a-f0-9]{12})?(?:\\\\|$)').test(normalized);
}
export function migrateSecretMetadata(input:Record<string,unknown>){
 let changed=false;
 const opaque=new Set(['text','content','prompt','instructions','password','access_token','refresh_token','id_token','key','secret','raw','payload','sops','guardrails']);
 function walk(value:unknown,field=''):unknown{
  if(opaque.has(field))return value;
  if(Array.isArray(value))return value.map(item=>walk(item,field));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>{
   const next=currentBrandKey(key);if(next!==key)changed=true;
   if(key==='kind'){const kind=currentBrandKind(item);if(kind!==item)changed=true;return[next,kind];}
   return[next,walk(item,key)];
  }));
  return value;
 }
 const value=walk(input) as Record<string,unknown>;
 return {value,changed};
}
