// The full build must start from the final delivered81 repair and its pinned helper.
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {json,hash} from './phased-backup-control.mjs';

export const accepted81Proof='F:/Agentopia/.supabase/desktop-skills-viewport81/1792992263401/package-proof.json';
export const accepted81ImageSha256='96f01f9cc0defe36603b0d50441647d3a47da486b9ed0c126cb7691dcf12e66f';
export function assertRelease82Base(installed,base,delivery){
 assert(installed.success&&base.success&&delivery.success);
 assert.equal(installed.version,'0.44.81');assert.equal(base.version,'0.44.81');assert.equal(base.schema,88);
 assert.equal(path.resolve(installed.proof),path.resolve(accepted81Proof));
 assert.equal(path.resolve(base.out),path.resolve(path.dirname(accepted81Proof)));
 assert.equal(installed.imageSha256,accepted81ImageSha256);assert.equal(base.imageSha256,accepted81ImageSha256);
 assert.equal(delivery.imageSha256,accepted81ImageSha256);assert.equal(delivery.version,'0.44.81');assert(delivery.installed);
}
export async function verifyRelease82Native(root,source){
 const folder=path.join(source,'native/computer'),manifest=await json(path.join(source,'src/computer-runtime-manifest.json'));
 assert.equal(manifest.version,'1.0.4','Release82 requires native computer helper protocol1.0.4');
 const names=(await readdir(folder)).filter(name=>/[.](cs|csproj)$/.test(name)).sort();
 const bytes=Buffer.concat(await Promise.all(names.map(async name=>Buffer.concat([Buffer.from(name+'\n'),await readFile(path.join(folder,name))]))));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sourceHash,'Regenerate and commit the native helper manifest with prepare-computer.mjs');
 assert.equal((await readFile(path.join(folder,'Agentopia.Computer.csproj'),'utf8')).match(/<Version>([^<]+)<\/Version>/)?.[1],manifest.version);
 assert.equal(manifest.sdk,'10.0.402');assert.equal(manifest.runtime,'10.0.13');assert.equal(manifest.entry,'Agentopia.Computer.exe');assert(Object.keys(manifest.files).length>0);
 const resources=path.join(root,'desktop/resources/computer-helper'),actual=[];
 for(const entry of await readdir(resources,{recursive:true,withFileTypes:true})){assert(!entry.isSymbolicLink());if(entry.isFile())actual.push(path.relative(resources,path.join(entry.parentPath,entry.name)).replaceAll('\\','/'));}
 assert.deepEqual(actual.sort(),Object.keys(manifest.files).sort(),'Native helper resources must exactly match the pinned inventory');
 for(const[name,digest]of Object.entries(manifest.files)){const file=path.resolve(resources,name);assert(file.startsWith(resources+path.sep));assert((await lstat(file)).isFile());assert.equal(await hash(file),digest,'Native helper resource: '+name);}
 return manifest;
}
