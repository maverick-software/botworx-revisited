import {pluginResource,pluginResourceBinding,pluginPrincipalIdentity,type PluginResourceBinding,type PluginPrincipal} from './plugin-resource-principal';
import {createHash} from 'node:crypto';
import type {ChatOptions} from './contracts';
import type {ToolDefinition} from './tool-contracts';
import type {Plugins} from './plugins';
import {pluginSkillPath} from './plugin-skill-files';
import {imageData} from './attachment-images';

export const pluginFileTools=['list_plugin_files','read_plugin_file'];
const integer=(value:unknown,fallback:number,max:number)=>{if(value===undefined)return fallback;if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>max)throw new Error('Choose a valid plugin file range.');return value;};
const identity=(packages:Array<{name:string;digest:string}>)=>JSON.stringify(packages.map(pkg=>[pkg.name,pkg.digest]).sort());
export type PluginFileBinding=PluginResourceBinding&{owner:string;key:string;packages:Array<{name:string;digest:string}>};
export class PluginFiles{
 constructor(private registry:Pick<Plugins,'skillPackages'>){}
 async capture(owner:string,agentId:PluginPrincipal):Promise<PluginFileBinding>{const available=await this.registry.skillPackages(owner,agentId),packages=[...new Map(available.flatMap(pkg=>[{name:pkg.name,digest:pkg.digest},...(pkg.aliases??[]).map(alias=>{const parts=alias.split(':');return {name:parts[1],digest:parts[2]};})]).map(pkg=>[pkg.name,pkg])).values()].sort((a,b)=>a.name.localeCompare(b.name));return {owner,...pluginResourceBinding(agentId),packages,key:createHash('sha256').update(JSON.stringify([owner,pluginPrincipalIdentity(agentId),packages])).digest('hex')};}
 async validate(binding:PluginFileBinding){const current=await this.capture(binding.owner,pluginResource(binding));if(current.key!==binding.key||identity(current.packages)!==identity(binding.packages))throw Error('The agent’s plugin files changed or were revoked. Start a fresh preview response.');}
 async validateSkills(binding:PluginFileBinding,selected:string[]){await this.validate(binding);const packages=await this.registry.skillPackages(binding.owner,pluginResource(binding));for(const value of selected){const match=/^agentopia-plugin:([^:]+):([a-f0-9]{64}):(skills\/[^:]+\/SKILL\.md)$/.exec(value);if(!match)throw Error('Choose a native skill from this agent’s assigned plugins.');pluginSkillPath(match[3]);const pkg=packages.find(pkg=>pkg.name===match[1]&&pkg.digest===match[2]||pkg.aliases?.includes(value));if(!pkg||!Object.hasOwn(pkg.package.files??{},match[3]))throw Error('The selected native skill changed or is unavailable. Refresh Skills before sending.');}await this.validate(binding);}
 async definitions(owner:string,agent:PluginPrincipal|undefined,options:ChatOptions):Promise<ToolDefinition[]>{
  if(options.permission==='chat'||!agent||!(await this.registry.skillPackages(owner,agent)).length)return [];
  return [
   {namespace:'tools',name:'list_plugin_files',description:'List reviewed skill files from enabled plugins assigned to this agent. Returns exact plugin names, digests and package-relative paths. This reads installed package metadata only.',parameters:{type:'object',properties:{plugin:{type:'string'},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}},
   {namespace:'tools',name:'read_plugin_file',description:'Read a reviewed skill instruction, bundled reference, script source or image from an assigned plugin. Supply the exact plugin, digest and path from list_plugin_files. Reads package bytes only; never executes a script or grants command permission. Text is paginated in characters.',parameters:{type:'object',properties:{plugin:{type:'string'},digest:{type:'string'},path:{type:'string'},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:16000}},required:['plugin','digest','path'],additionalProperties:false}}
  ];
 }
 async execute(owner:string,agent:PluginPrincipal,tool:string,args:Record<string,unknown>,options:ChatOptions,guard:()=>Promise<void>){
  if(options.permission==='chat'||!pluginFileTools.includes(tool))throw new Error('Plugin file access is not enabled.');await guard();const available=await this.registry.skillPackages(owner,agent),signature=identity(available),packages=available.flatMap(pkg=>[pkg,...(pkg.aliases??[]).map(alias=>{const parts=alias.split(':');return {...pkg,name:parts[1],digest:parts[2]};})]);let result:unknown;
  if(tool==='list_plugin_files'){
   if(args.plugin!==undefined&&(typeof args.plugin!=='string'||args.plugin.length>100))throw new Error('Choose an assigned plugin.');const offset=integer(args.offset,0,1000000),limit=integer(args.limit,50,100);if(!limit)throw new Error('Choose a nonzero plugin file limit.');
   const files=packages.filter(pkg=>args.plugin===undefined||pkg.name===args.plugin).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(pkg=>Object.entries(pkg.package.files??{}).sort(([a],[b])=>a.localeCompare(b)).map(([file,bytes])=>({plugin:pkg.name,digest:pkg.digest,path:file,bytes:Buffer.from(bytes,'base64').length})));
   result={files:files.slice(offset,offset+limit),total:files.length,next_offset:offset+limit<files.length?offset+limit:null,untrusted:true};
  }else{
   if(typeof args.plugin!=='string'||typeof args.digest!=='string'||!/^[a-f0-9]{64}$/.test(args.digest)||typeof args.path!=='string')throw new Error('Choose an exact reviewed plugin file.');pluginSkillPath(args.path);const pkg=packages.find(pkg=>pkg.name===args.plugin&&pkg.digest===args.digest&&Object.hasOwn(pkg.package.files??{},String(args.path)));if(!pkg)throw new Error('This plugin file is unavailable or its reviewed package changed.');
   const bytes=Buffer.from(pkg.package.files![args.path],'base64'),metadata={plugin:pkg.name,digest:pkg.digest,path:args.path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),untrusted:true},offset=integer(args.offset,0,1000000),limit=integer(args.limit,12000,16000);if(!limit)throw new Error('Choose a nonzero plugin file limit.');let text:string|undefined;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.includes('\0'))text=undefined;}catch{}
   if(text!==undefined)result={...metadata,encoding:'utf-8',text:text.slice(offset,offset+limit),characters:text.length,next_offset:offset+limit<text.length?offset+limit:null};
   else{let data:string|undefined;try{data=imageData(bytes);}catch{}const image=data?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);if(!image)throw new Error('This binary skill asset cannot be read as text or a supported image.');if(offset)throw new Error('Images do not use text offsets.');result={...metadata,content:[{type:'image',mimeType:image[1],data:image[2]}]};}
  }
  await guard();if(identity(await this.registry.skillPackages(owner,agent))!==signature)throw new Error('The plugin assignment or reviewed package changed during this read.');await guard();return result;
 }
}
