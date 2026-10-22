import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync,statSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';desktopOperation('packaging');
const root=path.resolve(import.meta.dirname,'../..'),lock=path.join(root,'desktop/.build-lock');
try{writeFileSync(lock,String(process.pid),{flag:'wx'});}catch{throw new Error('Another desktop build or package operation holds desktop/.build-lock. Let it finish before packaging again.');}
process.on('exit',()=>{try{unlinkSync(lock);}catch{}});
const env={...process.env,AGENTOPIA_BUILD_LOCK_OWNED:'1'};
function run(args){const result=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit'});if(result.status!==0)throw new Error(`Desktop build step failed (${result.status??'spawn error'}).`);}
run(['scripts/desktop/build.mjs']);
run([process.env.npm_execpath,'--prefix','desktop/staging','install','--ignore-scripts']);
const forge=JSON.parse(readFileSync(path.join(root,'node_modules/@electron-forge/cli/package.json'),'utf8'));
// Squirrel's x86 resource and metadata writers both load the large archive.
// The metadata writer can silently discard it after a successful embed. Enable
// large-address-space support for these helpers and the x64-target bootstrapper,
// and restore the pinned vendor files after the build.
const helpers=['WriteZipToSetup.exe','rcedit.exe','Setup.exe'].map(name=>{
 const file=path.join(root,'node_modules/electron-winstaller/vendor',name),original=readFileSync(file),adjusted=Buffer.from(original);
 const pe=adjusted.readUInt32LE(0x3c);
 if(adjusted.toString('ascii',pe,pe+4)!=='PE\0\0')throw new Error('Unexpected Squirrel helper format: '+name);
 if(adjusted.readUInt16LE(pe+4)===0x14c)adjusted.writeUInt16LE(adjusted.readUInt16LE(pe+22)|0x20,pe+22);
 return {file,original,adjusted};
});
try{
 for(const helper of helpers)writeFileSync(helper.file,helper.adjusted);
 run([path.join(root,'node_modules/@electron-forge/cli',forge.bin['electron-forge']),'make','desktop/staging']);
}finally{for(const helper of helpers)writeFileSync(helper.file,helper.original);}
const output=path.join(root,'desktop/staging/out/make/squirrel.windows/x64');
const full=readdirSync(output).find(name=>name.endsWith('-full.nupkg'));
if(!full||statSync(path.join(output,'AgentopiaSetup.exe')).size<statSync(path.join(output,full)).size*0.9){
 throw new Error('The installer payload was not embedded. Inspect Squirrel-Releasify.log; a successful Forge exit alone is insufficient.');
}
