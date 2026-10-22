import {extractFile} from '@electron/asar';
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-computer-review/release');await mkdir(out,{recursive:true});
const previous=process.env.AGENTOPIA_PREVIOUS_EXE;assert(previous,'Set AGENTOPIA_PREVIOUS_EXE to the retained installed application.');
const archive=path.join(path.dirname(previous),'resources/app.asar'),build=path.join(root,'desktop/build'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');let modules=0;
for(const entry of await readdir(build,{recursive:true,withFileTypes:true})){
 if(!entry.isFile()||!/[.](js|json)$/.test(entry.name))continue;
 const file=path.join(entry.parentPath,entry.name),relative=path.relative(build,file);assert.equal(hash(extractFile(archive,path.join('build',relative))),hash(await readFile(file)),relative);modules++;
}
const previousPackage=JSON.parse(extractFile(archive,'package.json').toString('utf8')),current=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
await writeFile(path.join(out,'backend-unchanged.json'),JSON.stringify({at:new Date().toISOString(),previousVersion:previousPackage.version,version:current.version,modules,allCompiledBackendModulesUnchanged:true,success:true},null,2));
console.log('PASS all '+modules+' compiled backend modules exactly match installed '+previousPackage.version+'; the review release changes the renderer and application version.');
