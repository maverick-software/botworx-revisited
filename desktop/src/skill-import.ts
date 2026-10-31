import path from 'node:path';
import {lstat,realpath,readdir} from 'node:fs/promises';
import {dialog} from 'electron';
import {pluginSkillPath,validatePluginSkillFiles} from './plugin-skill-files';
import {randomUUID} from 'node:crypto';
import {readPluginSource,readBounded,parsePluginArchive,pluginImportLimits} from './plugin-import';
import {validatePluginPackage} from './plugin-validation';
import {pluginSchemaUrl} from './plugin-contracts';
import {splitSkillPackage} from './skills';

/** Canonicalize ordinary skill folders/ZIPs without requiring plugin declarations. */
export function skillFilesPackage(source:Map<string,Buffer>){
 const roots=[...source.keys()].filter(file=>file==='SKILL.md'||file.endsWith('/SKILL.md')).map(file=>file.slice(0,-8));
 if(!roots.length)throw Error('Choose a SKILL.md file, skill folder, collection, or ZIP containing skills.');
 if(roots.some(root=>roots.some(other=>root!==other&&root.startsWith(other))))throw Error('Skill folders cannot contain another skill folder.');
 const files:Record<string,string>={},names=new Set<string>();
 for(const root of roots){const name=root?root.slice(0,-1).split('/').at(-1)!:'imported';if(names.has(name.toLowerCase()))throw Error('Skill folders must have distinct names.');names.add(name.toLowerCase());for(const [file,bytes] of source)if(file.startsWith(root)){const canonical=pluginSkillPath('skills/'+name+'/'+file.slice(root.length));files[canonical]=bytes.toString('base64');}}
 validatePluginSkillFiles(files);const pkg=validatePluginPackage({manifest:{$schema:pluginSchemaUrl,name:'skills-'+randomUUID(),version:'1.0.0',description:'Imported skill collection'},files});splitSkillPackage(pkg);return pkg;
}
export async function readSkillSource(selected:string,kind:'file'|'folder',guard:()=>Promise<void>,checkPath:(file:string)=>void){
 const root=path.resolve(selected);await guard();checkPath(root);
 if(kind==='file'&&path.extname(root).toLowerCase()==='.json')return readPluginSource(root,kind,guard,checkPath);
 if(kind==='file'&&path.extname(root).toLowerCase()==='.zip'){
  const bytes=await readBounded(root,pluginImportLimits.archive,guard,checkPath);
  const pkg=parsePluginArchive(bytes,undefined,files=>files.has('plugin.json')||[...files.keys()].some(name=>name.endsWith('/plugin.json'))?parsePluginArchive(bytes):skillFilesPackage(files));await guard();return {package:pkg};
 }
 const directory=kind==='file'?path.dirname(root):root;
 if(kind==='file'&&path.basename(root)!=='SKILL.md')throw Error('Choose SKILL.md, a skill ZIP, or an exported JSON package.');
 if(kind==='folder'){for(const declaration of ['plugin.json','.codex-plugin/plugin.json']){try{await lstat(path.join(directory,declaration));return readPluginSource(directory,'folder',guard,checkPath);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}}
 const files=new Map<string,Buffer>();let bytes=0,count=0;const same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
 const walk=async(folder:string,relative:string):Promise<void>=>{await guard();checkPath(folder);const stat=await lstat(folder);if(!stat.isDirectory()||stat.isSymbolicLink()||!same(await realpath(folder),folder))throw Error('Linked skill folders cannot be imported.');if(relative.split('/').length>13)throw Error('Skill directories are nested too deeply.');for(const name of await readdir(folder)){if(name.startsWith('.'))continue;if(++count>128)throw Error('Choose a collection with at most 128 entries.');const file=path.join(folder,name);checkPath(file);const entry=await lstat(file);if(entry.isDirectory()&&!entry.isSymbolicLink())await walk(file,relative+name+'/');else{const contents=await readBounded(file,2097152,guard,checkPath);bytes+=contents.length;if(bytes>2097152)throw Error('Skill resources exceed 2 MB.');files.set(relative+name,contents);}}};await walk(directory,'');await guard();return {package:skillFilesPackage(files)};
}
export async function pickSkillSource(kind:unknown,guard:()=>Promise<void>,checkPath:(file:string)=>void){
 if(kind!=='file'&&kind!=='folder')throw Error('Choose a skill file, folder or package.');await guard();const selection=await dialog.showOpenDialog({title:'Import skills',properties:[kind==='folder'?'openDirectory':'openFile'],...(kind==='file'?{filters:[{name:'Skills and packages',extensions:['md','zip','json']}]}:{})});await guard();if(selection.canceled)return null;if(selection.filePaths.length!==1)throw Error('Choose one skill source.');return readSkillSource(selection.filePaths[0],kind,guard,checkPath);
}
