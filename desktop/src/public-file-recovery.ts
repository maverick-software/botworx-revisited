import path from 'node:path';
import {createHash} from 'node:crypto';
import {lstat,realpath,readFile} from 'node:fs/promises';
import type {FileReference} from './contracts';
import {privateProfilePath} from './desktop-profile';
import {relocatedProfileRoot} from './desktop-profile-location';

export type PublicOutputInventory={files:Record<string,{bytes:number;sha256:string;mtimeMs?:number}>;directories:string[]};
export type PublicReferenceIndex={format:1;sourceRoot:string;sourceProfile:string;accounts:{owner:string;references:{id:string;name:string;kind:'file'|'folder';relativePath:string;formerPaths?:string[]}[]}[]};
export type RecoveredReference={reference:FileReference;formerPath:string};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const inside=(root:string,target:string)=>{const rel=path.relative(root,target);return !!rel&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
function requireValue(condition:unknown,message:string):asserts condition{if(!condition)throw Error(message);}
function relativeName(name:string){
 requireValue(typeof name==='string'&&name&&name===path.posix.normalize(name)&&!path.posix.isAbsolute(name)&&!/[\\:\x00-\x1f\x7f]/.test(name),'Invalid recovered output path.');
 const parts=name.split('/');requireValue(parts.every(n=>n!=='.'&&n!=='..'&&!/[. ]$/.test(n)&&!/[<>"|?*]/.test(n)&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(n))&&/^[a-f0-9]{12}$/i.test(parts[0])&&(parts.length===1||uuid.test(parts[1])),'Invalid recovered output ownership.');return parts;
}
export function validatePublicReferenceIndex(index:PublicReferenceIndex,inventory:PublicOutputInventory){
 requireValue(index?.format===1&&path.isAbsolute(index.sourceRoot)&&path.basename(index.sourceRoot)==='Agentopia Files'&&path.isAbsolute(index.sourceProfile)&&(inside(path.dirname(index.sourceRoot),index.sourceProfile)||relocatedProfileRoot(index.sourceProfile)),'Invalid public-file recovery origin.');
 requireValue(Array.isArray(index.accounts)&&index.accounts.length<=10000&&inventory?.files&&Array.isArray(inventory.directories),'Invalid public-file recovery inventory.');
 const directories=new Set(inventory.directories),names=new Set<string>();
 for(const name of [...inventory.directories,...Object.keys(inventory.files)]){relativeName(name);requireValue(!names.has(name.toLowerCase()),'Duplicate recovered output path.');names.add(name.toLowerCase());const parts=name.split('/');for(let i=1;i<parts.length;i++)requireValue(directories.has(parts.slice(0,i).join('/')),'Missing recovered parent directory.');}
 for(const [name,row]of Object.entries(inventory.files)){requireValue(name.split('/').length>=3&&row&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&/^[a-f0-9]{64}$/.test(row.sha256),'Invalid recovered file hash.');}
 const owners=new Set<string>();for(const account of index.accounts){requireValue(uuid.test(account.owner)&&!owners.has(account.owner.toLowerCase())&&Array.isArray(account.references)&&account.references.length<=100,'Invalid recovered account references.');owners.add(account.owner.toLowerCase());const ids=new Set<string>(),paths=new Set<string>();
  for(const reference of account.references){const parts=relativeName(reference.relativePath);requireValue(parts.length>=2&&same(parts[1],account.owner)&&uuid.test(reference.id)&&!ids.has(reference.id.toLowerCase())&&!paths.has(reference.relativePath.toLowerCase())&&typeof reference.name==='string'&&reference.name===parts.at(-1)&&(reference.kind==='file'?!!inventory.files[reference.relativePath]:reference.kind==='folder'&&directories.has(reference.relativePath)),'Invalid or foreign recovered attachment.');if(reference.formerPaths!==undefined)requireValue(Array.isArray(reference.formerPaths)&&reference.formerPaths.length<=32&&reference.formerPaths.every(value=>typeof value==='string'&&value.length<=4000&&path.isAbsolute(value)&&!/[\x00-\x1f\x7f]/.test(value)&&!privateProfilePath(value))&&new Set(reference.formerPaths.map(value=>path.resolve(value).toLowerCase())).size===reference.formerPaths.length,'Invalid recovered former paths.');ids.add(reference.id.toLowerCase());paths.add(reference.relativePath.toLowerCase());}
 }
 return index;
}
export function capturePublicReferenceIndex(sourceRoot:string,sourceProfile:string,accounts:{owner:string;references:FileReference[]}[],inventory:PublicOutputInventory):PublicReferenceIndex{
 sourceRoot=path.resolve(sourceRoot);sourceProfile=path.resolve(sourceProfile);
 const index:PublicReferenceIndex={format:1,sourceRoot,sourceProfile,accounts:accounts.map(account=>({owner:account.owner,references:account.references.filter(row=>row.source!=='clipboard'&&inside(sourceRoot,path.resolve(row.path))).map(row=>({id:row.id,name:row.name,kind:row.kind,relativePath:path.relative(sourceRoot,path.resolve(row.path)).split(path.sep).join('/'),...(row.recoveryPaths?.length?{formerPaths:[...row.recoveryPaths]}:{})}))}))};
 return validatePublicReferenceIndex(index,inventory);
}
export function publicReferenceIndexId(index:PublicReferenceIndex){return createHash('sha256').update(JSON.stringify(index)).digest('hex');}
export function planRecoveredPublicReferences(index:PublicReferenceIndex,inventory:PublicOutputInventory,destinationRoot:string,owner:string):RecoveredReference[]{
 validatePublicReferenceIndex(index,inventory);requireValue(uuid.test(owner)&&path.isAbsolute(destinationRoot)&&path.basename(destinationRoot)==='Agentopia Files','Invalid recovered output destination.');
 return (index.accounts.find(account=>same(account.owner,owner))?.references??[]).map(row=>({formerPath:path.join(index.sourceRoot,...row.relativePath.split('/')),reference:{id:row.id,name:row.name,kind:row.kind,path:path.join(destinationRoot,...row.relativePath.split('/')),recoveryPaths:[...new Set([...(row.formerPaths??[]),path.join(index.sourceRoot,...row.relativePath.split('/'))])]}}));
}
async function regular(root:string,target:string,kind:'file'|'folder'){
 requireValue(inside(root,target),'Recovered attachment left its output collection.');
 for(let current=path.resolve(target);;current=path.dirname(current)){const info=await lstat(current);requireValue(!info.isSymbolicLink()&&same(await realpath(current),current),'Recovered output contains a linked or redirected path.');if(same(current,target))requireValue(kind==='file'?info.isFile()&&info.nlink===1:info.isDirectory(),'Recovered attachment changed type.');else requireValue(info.isDirectory(),'Invalid recovered output ancestor.');if(path.dirname(current)===current)break;}
}
export async function verifyRecoveredPublicReferences(index:PublicReferenceIndex,inventory:PublicOutputInventory,destinationRoot:string,owner:string,guard:()=>Promise<void>){
 const planned=planRecoveredPublicReferences(index,inventory,destinationRoot,owner);await guard();
 const names=new Set<string>();for(const item of planned){const relative=path.relative(destinationRoot,item.reference.path).split(path.sep).join('/');for(const name of Object.keys(inventory.files))if(item.reference.kind==='file'?name===relative:name.startsWith(relative+'/'))names.add(name);await regular(destinationRoot,item.reference.path,item.reference.kind);}
 for(const name of names){const target=path.join(destinationRoot,...name.split('/')),row=inventory.files[name];await guard();await regular(destinationRoot,target,'file');const before=await lstat(target),bytes=await readFile(target),after=await lstat(target);await regular(destinationRoot,target,'file');requireValue(before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs&&bytes.length===row.bytes&&createHash('sha256').update(bytes).digest('hex')===row.sha256,'Recovered attachment bytes changed.');await guard();}
 await guard();return planned;
}
// Translation is lexical: only the recovered workspace suffix is used. It
// never opens an earlier Windows account's original profile or public files.
export function translateRecoveredPath(index:PublicReferenceIndex,owner:string,raw:string,destinationRoot:string,nativeDirectory:string){
 if(!path.isAbsolute(raw)||!uuid.test(owner))return raw;
 const aliases=(index.accounts.find(account=>same(account.owner,owner))?.references??[]).flatMap(reference=>(reference.formerPaths??[]).map(former=>({reference,former}))).filter(({reference,former})=>same(path.resolve(former),path.resolve(raw))||reference.kind==='folder'&&inside(former,path.resolve(raw))).sort((a,b)=>b.former.length-a.former.length);if(aliases[0])return path.join(destinationRoot,aliases[0].reference.relativePath,path.relative(aliases[0].former,raw));
 const source=path.resolve(raw),home=path.dirname(index.sourceRoot),roots=[index.sourceProfile,path.join(home,'.agentopia/desktop/profile'),path.join(home,'AppData/Roaming/Agentopia')];
 for(const root of roots){const scratch=path.join(root,'workspaces',owner);if(inside(scratch,source))return path.join(nativeDirectory,'workspaces',owner,path.relative(scratch,source));}
 const cached=path.relative(home,source).split(path.sep);if(cached.length>=11&&cached[0].toLowerCase()==='appdata'&&cached[1].toLowerCase()==='local'&&cached[2].toLowerCase()==='packages'&&/^[a-z0-9_.-]+$/i.test(cached[3])&&cached[4].toLowerCase()==='localcache'&&cached[5].toLowerCase()==='roaming'&&cached[6].toLowerCase()==='agentopia'&&cached[7].toLowerCase()==='workspaces'&&same(cached[8],owner)&&!cached.includes('..'))return path.join(nativeDirectory,'workspaces',owner,...cached.slice(9));
 const relative=path.relative(index.sourceRoot,source).split(path.sep);if(relative.length>=3&&/^[a-f0-9]{12}$/i.test(relative[0])&&same(relative[1],owner)&&!relative.includes('..'))return path.join(destinationRoot,...relative);
 return raw;
}
