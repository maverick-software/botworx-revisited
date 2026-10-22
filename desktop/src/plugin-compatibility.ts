import {pluginSchemaUrl,mcpSchemaUrl} from './plugin-contracts';
import {pluginSkillPath} from './plugin-skill-files';
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const metadata=['name','version','description','author','homepage','repository','license','keywords','extensions'];
export function pluginComponentPath(value:unknown){
 if(typeof value!=='string'||!value.startsWith('./')||value.length>500||/[\\\x00-\x1f:*?<>|]/.test(value))throw Error('Plugin component paths must start with ./ and stay inside the package.');
 const relative=value.slice(2).replace(/\/$/,'');if(!relative||relative.split('/').some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p)))throw Error('Plugin component paths must stay inside the package without aliases.');return relative;
}
function settings(value:unknown){
 if(!object(value))throw Error('The Codex compatibility manifest must be an object.');
 if(Object.keys(value).some(k=>!['$schema',...metadata,'skills','mcpServers','interface','id','apps','hooks'].includes(k)))throw Error('This Codex package declares unsupported components.');
 const nested=value.extensions?.['com.openai'];if(nested!==undefined&&!object(nested))throw Error('OpenAI plugin settings must be an object.');
 return {...nested,...Object.fromEntries(['interface','id','apps','hooks'].filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]]))};
}
export type PluginDocumentPlan={manifest:Record<string,any>;portable:boolean;skillRoots:string[];explicitSkills:boolean;mcpPath?:string;explicitMcp:boolean};
export function planPluginDocuments(root:unknown,compatibility:unknown,names:Set<string>):PluginDocumentPlan{
 const portable=root!==undefined||object(compatibility)&&compatibility.$schema===pluginSchemaUrl;
 const source=root??compatibility;if(!object(source))throw Error('The package needs plugin.json at its root, or .codex-plugin/plugin.json.');
 if(portable){
  const manifest=JSON.parse(JSON.stringify(source));
  if(root!==undefined&&manifest.extensions?.['com.openai']===undefined&&compatibility!==undefined){const fallback=settings(compatibility);if(Object.keys(fallback).length)manifest.extensions={...manifest.extensions,'com.openai':fallback};}
  return {manifest,portable:true,skillRoots:['skills'],explicitSkills:false,mcpPath:names.has('mcp.json')?'mcp.json':undefined,explicitMcp:false};
 }
 if(Object.hasOwn(source,'$schema'))throw Error('This Codex compatibility manifest declares an unsupported schema.');
 const openai=settings(source),manifest:Record<string,any>={$schema:pluginSchemaUrl,...Object.fromEntries(metadata.filter(k=>Object.hasOwn(source,k)).map(k=>[k,source[k]]))};
 if(Object.keys(openai).length)manifest.extensions={...manifest.extensions,'com.openai':openai};
 const explicitSkills=Object.hasOwn(source,'skills'),raw=explicitSkills?source.skills:['./skills/'];if(typeof raw!=='string'&&!Array.isArray(raw))throw Error('Codex skills must declare package-relative directories.');
 const skillRoots=(Array.isArray(raw)?raw:[raw]).map(pluginComponentPath);if(skillRoots.length>128||skillRoots.some((p,i)=>skillRoots.some((other,j)=>i!==j&&(p.toLowerCase()===other.toLowerCase()||p.toLowerCase().startsWith(other.toLowerCase()+'/')))))throw Error('Declared skill directories must be distinct and cannot overlap.');
 for(const directory of skillRoots)pluginSkillPath('skills/component-root/'+directory+'/path-check.txt');
 const explicitMcp=Object.hasOwn(source,'mcpServers'),mcpPath=explicitMcp?pluginComponentPath(source.mcpServers):names.has('.mcp.json')?'.mcp.json':names.has('mcp.json')?'mcp.json':undefined;
 return {manifest,portable:false,skillRoots,explicitSkills,mcpPath,explicitMcp};
}
export function normalizeCompatibilityMcp(value:unknown,portable:boolean){
 if(portable)return value;if(!object(value)||!object(value.mcpServers))return value;
 return {...value,$schema:mcpSchemaUrl,mcpServers:Object.fromEntries(Object.entries(value.mcpServers).map(([name,s])=>[name,object(s)?{...s,type:s.type==='http'||s.type===undefined&&typeof s.url==='string'?'streamable-http':s.type}:s]))};
}
/** Validate descriptive OpenAI metadata; executable extension surfaces remain explicit errors. */
export function validateOpenAIPresentation(value:unknown){
 if(!object(value)||Object.keys(value).some(k=>!['interface','id'].includes(k)))throw Error('OpenAI app mappings, setup workflows, hooks and other executable extensions are not supported by this host yet.');
 if(value.id!==undefined&&(typeof value.id!=='string'||!value.id.trim()||value.id.length>200))throw Error('Invalid OpenAI plugin identity.');if(value.interface===undefined)return;
 const v=value.interface;if(!object(v))throw Error('OpenAI plugin interface metadata must be an object.');
 const strings:Record<string,number>={displayName:80,shortDescription:240,longDescription:4000,developerName:120,category:80},urls=['websiteURL','privacyPolicyURL','termsOfServiceURL','supportURL'],assets=['composerIcon','logo'];
 const text=(x:unknown,max:number,multiline=false)=>typeof x==='string'&&x.trim().length>0&&x.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(x)&&(multiline||!/[\r\n]/.test(x));
 const list=(x:unknown,count:number,max:number)=>Array.isArray(x)&&x.length<=count&&x.every(item=>text(item,max));
 for(const [key,item]of Object.entries(v)){
  if(key in strings){if(!text(item,strings[key],key==='longDescription'))throw Error('Invalid OpenAI plugin presentation text.');}
  else if(urls.includes(key)){if(!text(item,2048))throw Error('Invalid OpenAI plugin presentation URL.');let url:URL;try{url=new URL(item as string);}catch{throw Error('Invalid OpenAI plugin presentation URL.');}if(url.protocol!=='https:'||url.username||url.password)throw Error('OpenAI presentation URLs must use HTTPS without credentials.');}
  else if(assets.includes(key))pluginComponentPath(item);
  else if(key==='screenshots'){if(!Array.isArray(item)||item.length>20)throw Error('Invalid OpenAI screenshot metadata.');item.forEach(pluginComponentPath);}
  else if(key==='defaultPrompt'){if(!(typeof item==='string'?text(item,512):list(item,3,512)))throw Error('Invalid OpenAI default prompts.');}
  else if(key==='capabilities'){if(!list(item,20,120))throw Error('Invalid OpenAI capabilities metadata.');}
  else if(key==='brandColor'||key==='brandColorDark'){if(typeof item!=='string'||!/^#[0-9a-f]{6}$/i.test(item))throw Error('Invalid OpenAI brand color.');}
  else throw Error('Unsupported OpenAI presentation metadata.');
 }
}
