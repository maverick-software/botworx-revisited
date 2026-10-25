import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {lstat,realpath,open,readdir,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import type {FileReference} from './contracts';
import type {ChatOptions} from './contracts';
import type {ToolDefinition} from './tool-contracts';
import {imageData} from './attachment-images';
import {safeName} from './workspace';
import type {NativeSkill} from './native-contracts';

type SkillFile={path:string;bytes:string;sha256:string;device:string;inode:string};
export type PreviewWorkspaceSkill={referenceId:string;referencePath:string;root:string;selection:string;device:string;inode:string;files:SkillFile[]};
export type PreviewWorkspaceSkills={version:1;owner:string;key:string;skills:PreviewWorkspaceSkill[]};
export type PreviewWorkspaceSkillRoot={directory:string;skill:PreviewWorkspaceSkill};
const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const same=(a:string,b:string)=>process.platform==='win32'?path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase():path.resolve(a)===path.resolve(b);
const inside=(root:string,file:string)=>{const relative=path.relative(root,file);return relative!==''&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep);};
export const previewWorkspaceSkillsKey=(owner:string,skills:PreviewWorkspaceSkill[])=>digest(JSON.stringify([owner,skills],(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value));
const key=previewWorkspaceSkillsKey;
const changed=()=>Error('A selected workspace skill changed. Refresh Skills before sending.');
const limits={entries:4096,bytes:16*1024*1024,fileBytes:2*1024*1024,skills:1000,depth:12};
async function directory(file:string){const info=await lstat(file,{bigint:true});if(!info.isDirectory()||info.isSymbolicLink()||!same(await realpath(file),file))throw changed();return info;}
async function read(file:string){
 const before=await lstat(file,{bigint:true});if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.size>BigInt(limits.fileBytes)||!same(await realpath(file),file))throw changed();
 const handle=await open(file,'r');try{const stat=await handle.stat({bigint:true});if(stat.dev!==before.dev||stat.ino!==before.ino||stat.size!==before.size)throw changed();const bytes=await handle.readFile(),after=await handle.stat({bigint:true}),current=await lstat(file,{bigint:true});if(bytes.length!==Number(before.size)||after.size!==before.size||after.mtimeNs!==before.mtimeNs||after.ctimeNs!==before.ctimeNs||current.dev!==before.dev||current.ino!==before.ino||current.isSymbolicLink()||!same(await realpath(file),file))throw changed();return {bytes,device:String(before.dev),inode:String(before.ino)};}finally{await handle.close();}
}

/** Only broker-owned selected folders can supply workspace skill bytes. */
export async function capturePreviewWorkspaceSkills(owner:string,references:FileReference[],selected:string[]|undefined,guard:()=>Promise<void>,checkPath:(file:string)=>void,options:{instructionsOnly?:boolean}={}):Promise<PreviewWorkspaceSkills>{
 const skills:PreviewWorkspaceSkill[]=[],seen=new Set<string>();let entries=0,total=0;
 const count=()=>{if(++entries>(selected?512:limits.entries))throw Error('Workspace skills contain too many bundled files. Select a smaller skill workspace.');};
 for(const reference of references.filter(row=>row.kind==='folder'&&row.source!=='clipboard')){
  await guard();checkPath(reference.path);await directory(reference.path);
  const base=path.join(reference.path,'.agents','skills');
  if(selected&&!selected.some(selection=>inside(base,selection)))continue;
  try{await directory(path.dirname(base));await directory(base);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
  const visit=async(root:string,depth:number):Promise<void>=>{
   await guard();if(depth>limits.depth)throw Error('Workspace skill folders are nested too deeply.');checkPath(root);const info=await directory(root),names=(await readdir(root)).sort();count();
   if(depth>0&&names.includes('SKILL.md')){
    const selection=path.join(root,'SKILL.md'),identity=process.platform==='win32'?selection.toLowerCase():selection;if(seen.has(identity))return;seen.add(identity);
    if(selected&&!selected.some(value=>same(value,selection)))return;
    if(skills.length>=(selected?20:limits.skills))throw Error('Too many workspace skills. Select a smaller skill workspace.');
    const files:SkillFile[]=[];
    const walk=async(current:string,level:number):Promise<void>=>{if(level>limits.depth)throw Error('Workspace skill folders are nested too deeply.');await directory(current);for(const name of (await readdir(current)).sort()){await guard();count();if(!safeName(name))continue;const file=path.join(current,name);checkPath(file);const stat=await lstat(file);if(stat.isDirectory()){await walk(file,level+1);continue;}const value=await read(file);total+=value.bytes.length;if(total>limits.bytes)throw Error('Selected workspace skill bundles exceed 16 MB. Select fewer skills.');files.push({path:path.relative(root,file).replaceAll('\\','/'),bytes:value.bytes.toString('base64'),sha256:digest(value.bytes),device:value.device,inode:value.inode});}};
    if(selected&&!options.instructionsOnly)await walk(root,0);else{count();const value=await read(selection);total+=value.bytes.length;if(total>limits.bytes)throw Error('Workspace skill instructions exceed the discovery limit.');files.push({path:'SKILL.md',bytes:value.bytes.toString('base64'),sha256:digest(value.bytes),device:value.device,inode:value.inode});}skills.push({referenceId:reference.id,referencePath:reference.path,root,selection,device:String(info.dev),inode:String(info.ino),files});return;
   }
   for(const name of names){if(!safeName(name))continue;const file=path.join(root,name);if(selected&&!selected.some(selection=>inside(file,selection)))continue;count();const stat=await lstat(file);if(stat.isSymbolicLink())throw changed();if(stat.isDirectory())await visit(file,depth+1);}
  };
  await visit(base,0);
 }
 if(selected?.some(value=>!path.isAbsolute(value)||!skills.some(skill=>same(skill.selection,value))))throw Error('Choose a native workspace skill from an attached folder’s .agents/skills directory.');
 await guard();return {version:1,owner,key:key(owner,skills),skills};
}

export function validatePreviewWorkspaceSkillSnapshot(snapshot:PreviewWorkspaceSkills){
 if(snapshot.version!==1||typeof snapshot.owner!=='string'||!Array.isArray(snapshot.skills)||snapshot.skills.length>limits.skills||snapshot.key!==key(snapshot.owner,snapshot.skills))throw changed();
 let count=0,total=0;const selections=new Set<string>();
 for(const skill of snapshot.skills){if(!skill.referenceId||!path.isAbsolute(skill.referencePath)||!inside(path.join(skill.referencePath,'.agents','skills'),skill.root)||!path.relative(path.join(skill.referencePath,'.agents','skills'),skill.root).split(path.sep).every(safeName)||!same(path.join(skill.root,'SKILL.md'),skill.selection)||!Array.isArray(skill.files)||!skill.files.some(file=>file.path==='SKILL.md'))throw changed();const identity=process.platform==='win32'?skill.selection.toLowerCase():skill.selection;if(selections.has(identity))throw changed();selections.add(identity);const names=new Set<string>();for(const file of skill.files){if(typeof file.path!=='string'||file.path.includes('\\')||!file.path.split('/').every(part=>part&&safeName(part)&&!part.includes(':'))||!inside(skill.root,path.join(skill.root,file.path)))throw changed();const name=process.platform==='win32'?file.path.toLowerCase():file.path;if(names.has(name))throw changed();names.add(name);const bytes=Buffer.from(file.bytes,'base64');if(bytes.toString('base64')!==file.bytes||digest(bytes)!==file.sha256||bytes.length>limits.fileBytes||++count>limits.entries||(total+=bytes.length)>limits.bytes)throw changed();}}
}

/** Rebuildable private native input; accepted bytes remain in the durable context. */
export class NativePreviewWorkspaceSkills{
 private physical?:{path:string;device:string;inode:string};private pending=new Map<string,Promise<PreviewWorkspaceSkillRoot[]>>();
 constructor(private cache:string){}
 async materialize(snapshot:PreviewWorkspaceSkills,guard:()=>Promise<void>):Promise<PreviewWorkspaceSkillRoot[]>{
  validatePreviewWorkspaceSkillSnapshot(snapshot);await guard();await mkdir(this.cache,{recursive:true});const stat=await lstat(this.cache,{bigint:true}),physical=await realpath(this.cache);if(stat.isSymbolicLink()||!stat.isDirectory())throw changed();const identity={path:physical,device:String(stat.dev),inode:String(stat.ino)};if(this.physical&&JSON.stringify(this.physical)!==JSON.stringify(identity))throw changed();this.physical??=identity;
  const owner=path.join(physical,digest(snapshot.owner).slice(0,24));try{await mkdir(owner);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}await directory(owner);
  const target=path.join(owner,snapshot.key.slice(0,32));let pending=this.pending.get(target);if(pending){const roots=await pending;await guard();return roots;}
  const verify=async()=>{await directory(target);const expected=new Map<string,string>([['receipt.json',digest(JSON.stringify({owner:snapshot.owner,key:snapshot.key}))]]),roots:PreviewWorkspaceSkillRoot[]=[];for(const[index,skill]of snapshot.skills.entries()){const root=path.join(target,'skills',String(index));await directory(root);for(const file of skill.files)expected.set('skills/'+index+'/'+file.path,file.sha256);roots.push({directory:root,skill});}let count=0;const walk=async(current:string):Promise<void>=>{await directory(current);for(const name of await readdir(current)){if(++count>limits.entries+limits.skills*limits.depth+2)throw changed();const file=path.join(current,name),stat=await lstat(file);if(stat.isDirectory())await walk(file);else{const relative=path.relative(target,file).replaceAll('\\','/'),expectedHash=expected.get(relative);if(!expectedHash||digest((await read(file)).bytes)!==expectedHash)throw changed();expected.delete(relative);}}};await walk(target);if(expected.size)throw changed();await guard();return roots;};
  pending=(async()=>{let exists=false;try{await lstat(target);exists=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}if(exists)return verify();if((await readdir(owner)).filter(name=>!name.startsWith('_stage-')).length>=100)throw Error('The preview workspace skill cache is full.');const stage=path.join(owner,'_stage-'+randomUUID());try{await mkdir(stage);for(const[index,skill]of snapshot.skills.entries())for(const file of skill.files){await guard();const output=path.join(stage,'skills',String(index),file.path);await mkdir(path.dirname(output),{recursive:true});await writeFile(output,Buffer.from(file.bytes,'base64'),{flag:'wx'});}await writeFile(path.join(stage,'receipt.json'),JSON.stringify({owner:snapshot.owner,key:snapshot.key}),{flag:'wx'});for(let attempt=0;;attempt++){await guard();await directory(owner);await directory(stage);try{await rename(stage,target);break;}catch(error){const code=(error as NodeJS.ErrnoException).code;if(!['EPERM','EACCES','EBUSY','EEXIST','ENOTEMPTY'].includes(code??''))throw error;let published=false;try{await lstat(target);published=true;}catch(inspect){if((inspect as NodeJS.ErrnoException).code!=='ENOENT')throw inspect;}if(published)return verify();if(!['EPERM','EACCES','EBUSY'].includes(code??'')||attempt>=7)throw error;await guard();await new Promise(resolve=>setTimeout(resolve,40*(attempt+1)));}}return await verify();}finally{try{await directory(owner);await directory(stage);if(path.dirname(stage)!==owner||!path.basename(stage).startsWith('_stage-'))throw changed();await rm(stage,{recursive:true,force:true});}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}})();
  this.pending.set(target,pending);try{return await pending;}finally{this.pending.delete(target);}
 }
 decorate(skills:NativeSkill[],roots:PreviewWorkspaceSkillRoot[]){return skills.map(skill=>{const root=roots.find(root=>same(path.join(root.directory,'SKILL.md'),skill.path));return root?{...skill,path:root.skill.selection,nativePath:skill.path}:skill;});}
}

export const previewWorkspaceSkillTools=['list_workspace_skill_files','read_workspace_skill_file'];
export function previewWorkspaceSkillDefinitions(snapshot:PreviewWorkspaceSkills|undefined,options:ChatOptions):ToolDefinition[]{
 if(!snapshot?.skills.length||options.permission==='chat')return [];
 const range={offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:16000}},skill={type:'string',description:'Exact original SKILL.md selection from the accepted workspace skill context.'};
 return [
  {name:'list_workspace_skill_files',description:'List files captured in explicitly selected workspace skill bundles. Returns exact skill selections, relative paths and hashes. Reads the accepted bundle only; never exposes other hidden files.',parameters:{type:'object',properties:{skill,...range,limit:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}},
  {name:'read_workspace_skill_file',description:'Read a captured workspace skill instruction, bundled reference, script source or image. Use the exact skill selection and bundle-relative path. Text is paginated in characters. This never executes scripts or grants command permission.',parameters:{type:'object',properties:{skill,path:{type:'string'},...range},required:['skill','path'],additionalProperties:false}}
 ];
}
export function readPreviewWorkspaceSkill(snapshot:PreviewWorkspaceSkills,tool:string,args:Record<string,unknown>){
 validatePreviewWorkspaceSkillSnapshot(snapshot);if(!previewWorkspaceSkillTools.includes(tool))throw Error('Unknown workspace skill reader.');
 const range=(value:unknown,fallback:number,max:number)=>{if(value===undefined)return fallback;if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>max)throw Error('Choose a valid workspace skill file range.');return value;};
 const offset=range(args.offset,0,limits.fileBytes),limit=range(args.limit,tool==='list_workspace_skill_files'?50:12000,tool==='list_workspace_skill_files'?100:16000);if(!limit)throw Error('Choose a nonzero workspace skill file limit.');
 if(args.skill!==undefined&&(typeof args.skill!=='string'||!snapshot.skills.some(skill=>skill.selection===args.skill)))throw Error('Choose an accepted workspace skill.');
 if(tool==='list_workspace_skill_files'){const files=snapshot.skills.filter(skill=>args.skill===undefined||skill.selection===args.skill).flatMap(skill=>skill.files.map(file=>({skill:skill.selection,path:file.path,bytes:Buffer.from(file.bytes,'base64').length,sha256:file.sha256})));return {files:files.slice(offset,offset+limit),total:files.length,next_offset:offset+limit<files.length?offset+limit:null,untrusted:true};}
 const skill=snapshot.skills.find(skill=>skill.selection===args.skill),file=skill?.files.find(file=>file.path===args.path);if(!skill||!file)throw Error('Choose an exact file from the accepted workspace skill bundle.');const bytes=Buffer.from(file.bytes,'base64'),metadata={skill:skill.selection,path:file.path,bytes:bytes.length,sha256:file.sha256,untrusted:true};let text:string|undefined;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.includes('\0'))text=undefined;}catch{}
 if(text!==undefined)return {...metadata,encoding:'utf-8',text:text.slice(offset,offset+limit),characters:text.length,next_offset:offset+limit<text.length?offset+limit:null};
 let image:string|undefined;try{image=imageData(bytes);}catch{}const match=image?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);if(!match||offset)throw Error('This skill asset is not supported text or an image.');return {...metadata,content:[{type:'image',mimeType:match[1],data:match[2]}]};
}
