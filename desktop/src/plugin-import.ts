import path from 'node:path';
import {lstat,realpath,open,opendir} from 'node:fs/promises';
import {crc32} from 'node:zlib';
import {Unzip,UnzipInflate} from 'fflate';
import {validatePluginPackage,pluginDigest} from './plugin-validation';
import type {PluginPackage} from './plugin-contracts';
import {pluginSkillLimits,pluginSkillPath} from './plugin-skill-files';
import {planPluginDocuments,normalizeCompatibilityMcp,type PluginDocumentPlan} from './plugin-compatibility';

export const pluginImportLimits={archive:4*1024*1024,documents:256000,entries:128,expanded:16*1024*1024};
const invalid=()=>new Error('The plugin ZIP is damaged or uses an unsupported archive layout.');
const decode=(bytes:Uint8Array)=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('Plugin declarations must use UTF-8 text.');}};
const parse=(bytes:Uint8Array,limit=pluginImportLimits.documents)=>{if(bytes.length>limit)throw new Error('Plugin declarations exceed their size limit.');try{return JSON.parse(decode(bytes).replace(/^\uFEFF/,''));}catch{throw new Error('Plugin declarations must contain valid UTF-8 JSON.');}};
const same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
function packagePath(name:string){
 if(!name||name.length>1000||name.startsWith('/')||/[\\\x00-\x1f:]/.test(name)||name.replace(/\/$/,'').split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Plugin archive paths must stay inside one package.');
 return name.replace(/\/$/,'');
}
function packagePrefix(names:string[]){if(names.includes('plugin.json')||names.includes('.codex-plugin/plugin.json'))return '';const first=new Set(names.map(name=>name.split('/')[0]));return first.size===1&&names.every(name=>name.includes('/'))?names[0].split('/')[0]+'/':'';}
function documentPlan(files:Map<string,Buffer>,prefix=''):PluginDocumentPlan{
 const root=files.get(prefix+'plugin.json'),compatibility=files.get(prefix+'.codex-plugin/plugin.json');
 return planPluginDocuments(root?parse(root):undefined,compatibility?parse(compatibility):undefined,new Set([...files.keys()].map(name=>name.slice(prefix.length))));
}
function documents(files:Map<string,Buffer>):PluginPackage{
 const names=[...files.keys()],prefix=packagePrefix(names);
 const relative=names.map(name=>name.slice(prefix.length));
 if(relative.some(name=>name.split('/')[0].toLowerCase()==='hooks'))throw new Error('This package contains hooks that this importer cannot install yet.');
 const plan=documentPlan(files,prefix),mcp=plan.mcpPath?files.get(prefix+plan.mcpPath):undefined;if(plan.explicitMcp&&!mcp)throw Error('The declared MCP configuration is missing.');
 const skills:Record<string,string>={};for(const directory of plan.skillRoots){const selected=names.filter(name=>name.startsWith(prefix+directory+'/'));if(plan.explicitSkills&&!selected.length)throw Error('A declared skill directory is missing.');const direct=files.has(prefix+directory+'/SKILL.md');for(const name of selected){const canonical='skills/'+(direct?directory.split('/').at(-1)+'/':'')+name.slice((prefix+directory+'/').length);pluginSkillPath(canonical);if(Object.hasOwn(skills,canonical))throw Error('Declared skills must have distinct canonical file names.');skills[canonical]=files.get(name)!.toString('base64');}}
 const declarationBytes=['plugin.json','.codex-plugin/plugin.json',plan.mcpPath].filter((x):x is string=>!!x).reduce((sum,name)=>sum+(files.get(prefix+name)?.length??0),0);if(declarationBytes>pluginImportLimits.documents)throw Error('Plugin declarations exceed 256 KB.');
 return validatePluginPackage({manifest:plan.manifest,...(mcp?{mcp:normalizeCompatibilityMcp(parse(mcp),plan.portable)}:{}),...(Object.keys(skills).length?{files:skills}:{})});
}

/** Read declarations and bounded skill snapshots. Archive contents are never extracted or executed. */
export function parsePluginArchive(input:Uint8Array,signal=new AbortController().signal,readDocuments:(files:Map<string,Buffer>)=>PluginPackage=documents):PluginPackage{
 signal.throwIfAborted();if(input.length<22||input.length>pluginImportLimits.archive)throw new Error('Choose a plugin ZIP smaller than 4 MB.');const bytes=Buffer.from(input.buffer,input.byteOffset,input.byteLength);
 if(bytes.readUInt32LE(0)!==0x04034b50)throw invalid();
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
 if(end<0||bytes.readUInt16LE(end+4)!==0||bytes.readUInt16LE(end+6)!==0)throw invalid();
 const count=bytes.readUInt16LE(end+10),length=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);if(count!==bytes.readUInt16LE(end+8)||!count||count>pluginImportLimits.entries||start+length!==end)throw invalid();
 const entries=new Map<string,{size:number;crc:number;method:number}>(),seen=new Set<string>();let cursor=start,total=0;
 for(let index=0;index<count;index++){
  signal.throwIfAborted();if(cursor+46>end||bytes.readUInt32LE(cursor)!==0x02014b50)throw invalid();
  const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),compressed=bytes.readUInt32LE(cursor+20),size=bytes.readUInt32LE(cursor+24),nameLength=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),offset=bytes.readUInt32LE(cursor+42),next=cursor+46+nameLength+extra+comment;
  if(next>end||flags&1||![0,8].includes(method)||bytes.readUInt16LE(cursor+34)!==0||((bytes.readUInt32LE(cursor+38)>>>16)&0xf000)===0xa000)throw invalid();
  const raw=bytes.subarray(cursor+46,cursor+46+nameLength),name=decode(raw),key=packagePath(name).toLowerCase();if(seen.has(key))throw new Error('Plugin archive entries must have distinct names.');seen.add(key);
  total+=size;if(total>pluginImportLimits.expanded)throw new Error('Expanded plugin files exceed 16 MB.');
  if(offset+30>start||bytes.readUInt32LE(offset)!==0x04034b50||bytes.readUInt16LE(offset+6)!==flags||bytes.readUInt16LE(offset+8)!==method)throw invalid();
  const localName=bytes.readUInt16LE(offset+26),localExtra=bytes.readUInt16LE(offset+28);if(localName!==nameLength||offset+30+localName+localExtra+compressed>start||!raw.equals(bytes.subarray(offset+30,offset+30+localName)))throw invalid();
  entries.set(name,{size,crc:bytes.readUInt32LE(cursor+16),method});cursor=next;
 }
 if(cursor!==end)throw invalid();
 const files=new Map<string,Buffer>(),completed=new Set<string>();let expandedBytes=0,visited=0;
 const unzip=new Unzip(file=>{
  signal.throwIfAborted();const entry=entries.get(file.name);if(!entry||file.compression!==entry.method)throw invalid();visited++;if(visited>count)throw invalid();
  const name=packagePath(file.name);if(file.name.endsWith('/'))return;
  // Component paths may be declared after their files in the ZIP. Collect bounded
  // bytes first, verify every CRC, then select declarations and skills without extraction.
  const chunks:Buffer[]=[];let size=0;
  file.ondata=(error,chunk,final)=>{if(error)throw invalid();signal.throwIfAborted();size+=chunk.length;expandedBytes+=chunk.length;if(size>entry.size||expandedBytes>pluginImportLimits.expanded){file.terminate();throw invalid();}chunks.push(Buffer.from(chunk));if(final){const contents=Buffer.concat(chunks);if(size!==entry.size||crc32(contents)!==entry.crc)throw invalid();files.set(name,contents);completed.add(name);}};file.start();
 });unzip.register(UnzipInflate);
 try{for(let offset=0;offset<bytes.length;offset+=512){signal.throwIfAborted();unzip.push(bytes.subarray(offset,Math.min(bytes.length,offset+512)),offset+512>=bytes.length);}}
 catch(error){if(error instanceof Error&&/Plugin|plugin|declarations/.test(error.message))throw error;signal.throwIfAborted();throw invalid();}
 if(visited!==count||[...entries.keys()].some(name=>!name.endsWith('/')&&!completed.has(name)))throw invalid();
 return readDocuments(files);
}

export async function readBounded(file:string,limit:number,guard:()=>Promise<void>,checkPath:(file:string)=>void){
 await guard();checkPath(file);const before=await lstat(file);if(!before.isFile()||before.isSymbolicLink()||before.nlink>1||before.size>limit||!same(await realpath(file),file))throw new Error('Choose a regular plugin declaration or ZIP within the size limit, without links.');
 const handle=await open(file,'r');try{
  const opened=await handle.stat();if(opened.ino!==before.ino||opened.dev!==before.dev||opened.size!==before.size)throw new Error('The selected plugin file changed. Choose it again.');
  const bytes=Buffer.alloc(before.size);let offset=0;while(offset<bytes.length){await guard();const read=await handle.read(bytes,offset,bytes.length-offset,offset);if(!read.bytesRead)throw new Error('The selected plugin file changed. Choose it again.');offset+=read.bytesRead;}
  const after=await handle.stat(),current=await lstat(file);if(after.ino!==before.ino||after.nlink>1||after.size!==before.size||after.mtimeMs!==before.mtimeMs||current.ino!==before.ino||current.isSymbolicLink()||!same(await realpath(file),file))throw new Error('The selected plugin file changed. Choose it again.');await guard();return bytes;
 }finally{await handle.close();}
}
export async function readPluginSource(selected:string,kind:'file'|'folder',guard:()=>Promise<void>=async()=>{},checkPath:(file:string)=>void=()=>{}){
 if(!path.isAbsolute(selected))throw new Error('Choose a local plugin file or folder.');const file=path.resolve(selected);await guard();checkPath(file);
 let pkg:PluginPackage;
 try{
  if(kind==='file'&&path.extname(file).toLowerCase()==='.zip')pkg=parsePluginArchive(await readBounded(file,pluginImportLimits.archive,guard,checkPath));
  else{
   let root=file;
   if(kind==='file'){
    if(path.extname(file).toLowerCase()!=='.json')throw new Error('Choose a JSON package, plugin.json or plugin ZIP.');const value=parse(await readBounded(file,pluginSkillLimits.packageBytes,guard,checkPath),pluginSkillLimits.packageBytes);
    if(value&&typeof value==='object'&&Object.hasOwn(value,'manifest')){pkg=validatePluginPackage(value);await guard();return {package:pkg,digest:pluginDigest(pkg),sourceName:path.basename(file)};}
    if(path.basename(file)!=='plugin.json')throw new Error('A standalone JSON file must contain manifest and mcp objects.');root=path.dirname(file);if(path.basename(root)==='.codex-plugin')root=path.dirname(root);
   }
   const stat=await lstat(root);checkPath(root);if(!stat.isDirectory()||stat.isSymbolicLink()||!same(await realpath(root),root))throw new Error('Choose a regular plugin folder without links.');
   const files=new Map<string,Buffer>();try{await lstat(path.join(root,'hooks'));throw new Error('This package contains hooks that this importer cannot install yet.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   let declarationBytes=0;for(const name of ['plugin.json','.codex-plugin/plugin.json','mcp.json','.mcp.json']){try{const bytes=await readBounded(path.join(root,name),pluginImportLimits.documents,guard,checkPath);declarationBytes+=bytes.length;if(declarationBytes>pluginImportLimits.documents)throw new Error('Plugin declarations exceed 256 KB.');files.set(name,bytes);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
   const plan=documentPlan(files);if(plan.mcpPath&&!files.has(plan.mcpPath)){try{files.set(plan.mcpPath,await readBounded(path.join(root,plan.mcpPath),pluginImportLimits.documents,guard,checkPath));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw Error('The declared MCP configuration is missing.');throw error;}}
   let skillBytes=0,entries=0;const walk=async(relative:string):Promise<void>=>{await guard();const absolute=path.join(root,relative);checkPath(absolute);const stat=await lstat(absolute);if(stat.isSymbolicLink()||!same(await realpath(absolute),absolute))throw new Error('Choose skill files and folders without links.');if(stat.isDirectory()){if(relative.split('/').length>13)throw new Error('Skill directories are nested too deeply.');for await(const entry of await opendir(absolute)){if(++entries>pluginImportLimits.entries)throw new Error('A plugin may contain up to 128 skill entries.');await walk(relative+'/'+entry.name);}}else{const bytes=await readBounded(absolute,pluginSkillLimits.fileBytes,guard,checkPath);skillBytes+=bytes.length;if(skillBytes>pluginSkillLimits.bytes)throw new Error('Combined skill files must be smaller than 2 MB.');files.set(relative,bytes);}};
   for(const directory of plan.skillRoots){let present=false;try{await lstat(path.join(root,directory));present=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}if(present)await walk(directory);else if(plan.explicitSkills)throw Error('A declared skill directory is missing.');}
   pkg=documents(files);
  }
 }catch(error){if(typeof (error as NodeJS.ErrnoException)?.code==='string')throw new Error('The selected plugin package could not be read. Check the selected files and try again.');throw error;}
 await guard();return {package:pkg,digest:pluginDigest(pkg),sourceName:path.basename(file)};
}
