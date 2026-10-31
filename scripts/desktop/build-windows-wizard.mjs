import {mkdir,readFile,writeFile,cp,copyFile,stat,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {extractAll,createPackage} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('setup wizard packaging');
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.env.SYLVANA_WIZARD_OUTPUT??'F:/Sylvana/verification/windows-wizard-20261029/candidate'),version=process.env.SYLVANA_WIZARD_VERSION??'0.46.2';
if(!/^[Ff]:[\\/]/.test(out)||!/^\d+\.\d+\.\d+$/.test(version))throw Error('A version and F-drive output folder are required.');
const proof=JSON.parse(await readFile(process.env.SYLVANA_WIZARD_BASE_PROOF??'F:/Sylvana/verification/dashboard-download-20261028/qualified-package.json','utf8'));
const hash=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
if(!proof.success||await hash(proof.program+'/resources/app.asar')!==proof.imageSha256)throw Error('The previously qualified program changed.');
await mkdir(out,{recursive:true});
const program=path.resolve(process.env.SYLVANA_WIZARD_INPUT??path.join(out,'program')),image=path.join(out,'image');
if(!/^[Ff]:[\\/]/.test(program)||process.env.SYLVANA_WIZARD_INPUT&&!process.argv.includes('--resume-installer'))throw Error('An external qualified program requires an F-drive path and --resume-installer.');
if(!process.argv.includes('--resume-installer')){
try{await stat(program);throw Error('The candidate folder already exists; inspect its checkpoint before rebuilding.');}catch(e){if(e.code!=='ENOENT')throw e;}
console.log('Copying the previously qualified program and resources.');
await cp(proof.program,program,{recursive:true});extractAll(path.join(program,'resources/app.asar'),image);
const baseline=JSON.parse(await readFile(new URL('./qualified-installer.json','file:///'+path.resolve(process.env.SYLVANA_WIZARD_BASE_PROOF??'F:/Sylvana/verification/dashboard-download-20261028/qualified-package.json').replaceAll('\\','/')),'utf8'));
if(!baseline.files||baseline.imageSha256!==proof.imageSha256)throw Error('A complete qualified baseline manifest is required.');
const baselineNames=[];
async function inspectBaseline(directory,prefix=''){for(const entry of await readdir(directory,{withFileTypes:true})){if(entry.isSymbolicLink())throw Error('The baseline contains a link.');const name=prefix+entry.name;if(entry.isDirectory())await inspectBaseline(path.join(directory,entry.name),name+'/');else baselineNames.push(name);}}
await inspectBaseline(program);
if(JSON.stringify(baselineNames.sort())!==JSON.stringify(Object.keys(baseline.files).sort()))throw Error('The baseline contains missing or unexpected files.');
for(const [name,digest] of Object.entries(baseline.files))if(await hash(path.join(program,name))!==digest)throw Error('A baseline resource changed: '+name);
const compiled=path.join(out,'compiled');await mkdir(compiled,{recursive:true});
await build({entryPoints:[path.join(root,'desktop/src/desktop-profile.ts')],outfile:path.join(compiled,'desktop-profile.js'),bundle:true,platform:'node',format:'cjs',target:'node22'});
await copyFile(path.join(compiled,'desktop-profile.js'),path.join(image,'build/desktop-profile.js'));
const setup=path.join(program,'resources/resources/setup');await mkdir(setup,{recursive:true});
await build({entryPoints:[path.join(root,'desktop/src/desktop-profile-location.ts')],outfile:path.join(setup,'profile-validator.cjs'),bundle:true,platform:'node',format:'cjs',target:'node22'});
await copyFile(path.join(root,'desktop/installer/profile-helper.cjs'),path.join(setup,'profile-helper.cjs'));
const metadata=JSON.parse(await readFile(path.join(image,'package.json'),'utf8'));metadata.version=version;await writeFile(path.join(image,'package.json'),JSON.stringify(metadata,null,2));
const resourceVersion=path.join(program,'resources/resources/version.json'),resource=JSON.parse(await readFile(resourceVersion,'utf8'));resource.version=version;await writeFile(resourceVersion,JSON.stringify(resource));
await createPackage(image,path.join(program,'resources/app.asar'));
await writeFile(out+'/qualified-package.json',JSON.stringify({success:true,format:'nsis-assisted',version,program,imageSha256:await hash(program+'/resources/app.asar'),base:proof,changedApplicationFiles:['build/desktop-profile.js','package.json'],changedResources:['version.json','setup/profile-helper.cjs','setup/profile-validator.cjs'],published:false},null,2));
}else{
 const qualified=JSON.parse(await readFile(out+'/qualified-package.json','utf8'));
 if(qualified.version!==version||path.resolve(qualified.program)!==program||qualified.imageSha256!==await hash(program+'/resources/app.asar'))throw Error('Resume requires the unchanged qualified application.');
 if(process.argv.includes('--refresh-profile-module')){
  await build({entryPoints:[path.join(root,'desktop/src/desktop-profile.ts')],outfile:path.join(image,'build/desktop-profile.js'),bundle:true,platform:'node',format:'cjs',target:'node22'});
  await createPackage(image,path.join(program,'resources/app.asar'));
  qualified.imageSha256=await hash(program+'/resources/app.asar');
  await writeFile(out+'/qualified-package.json',JSON.stringify(qualified,null,2));
 }
 if(process.env.SYLVANA_WIZARD_INPUT){
  if(await hash(path.join(root,'desktop/installer/profile-helper.cjs'))!==await hash(path.join(program,'resources/resources/setup/profile-helper.cjs')))throw Error('Refresh and verify the owned candidate before sharing its program tree.');
 }else await copyFile(path.join(root,'desktop/installer/profile-helper.cjs'),path.join(program,'resources/resources/setup/profile-helper.cjs'));
}
const setup=path.join(program,'resources/resources/setup');
const nsis=value=>value.replaceAll('$','$$').replaceAll('"','$\\"');
const isolated=process.env.SYLVANA_WIZARD_VERIFICATION==='1',home=isolated?process.env.SYLVANA_WIZARD_TEST_HOME:'$PROFILE',appData=isolated?path.join(home,'AppData/Roaming'):'$APPDATA';
const defines={SYLVANA_SETUP_NODE:path.join(program,'resources/resources/script-runtimes/node-24.22.0/node.exe'),SYLVANA_SETUP_HELPER:path.join(setup,'profile-helper.cjs'),SYLVANA_SETUP_VALIDATOR:path.join(setup,'profile-validator.cjs'),SYLVANA_SETUP_MODE:isolated?'isolated':'production'};
let include=Object.entries(defines).map(([k,v])=>'!define '+k+' "'+nsis(v)+'"').join('\n');
const files=[],directories=[];
async function owned(directory,prefix=''){for(const entry of await readdir(directory,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isSymbolicLink())throw Error('The release tree must not contain links.');if(entry.isDirectory()){directories.push(name);await owned(path.join(directory,entry.name),name+'/');}else files.push(name);}}
await owned(program);
const fileHashes={};for(const name of files)fileHashes[name]=await hash(path.join(program,name));
const fingerprint=createHash('sha256').update(JSON.stringify(fileHashes)).digest('hex');
let previousFingerprint;try{previousFingerprint=JSON.parse(await readFile(out+'/archive-program-fingerprint.json','utf8')).sha256;}catch(error){if(error.code!=='ENOENT')throw error;}
if(previousFingerprint!==fingerprint){
 const name=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).name;if(!/^[a-z0-9-]+$/.test(name))throw Error('Unexpected archive package name.');
 for(const extension of ['7z','zip'])try{await unlink(path.join(out,name+'-'+version+'-x64.nsis.'+extension));}catch(error){if(error.code!=='ENOENT')throw error;}
 await writeFile(out+'/archive-program-fingerprint.json',JSON.stringify({sha256:fingerprint},null,2));
}
include+='\n!macro SYLVANA_REMOVE_OWNED_FILES\n'+files.map(name=>'  Delete "$INSTDIR\\'+nsis(name.replaceAll('/','\\'))+'"').join('\n')+'\n'+directories.sort((a,b)=>b.length-a.length).map(name=>'  RMDir "$INSTDIR\\'+nsis(name.replaceAll('/','\\'))+'"').join('\n')+'\n!macroend\n';
include+='\n!define SYLVANA_SETUP_HOME "'+(isolated?nsis(home):home)+'"\n!define SYLVANA_SETUP_APPDATA "'+(isolated?nsis(appData):appData)+'"\n!include "'+nsis(path.join(root,'desktop/installer/wizard.nsh'))+'"\n';
await writeFile(out+'/wizard-include.nsh',include);
console.log('Building the assisted Windows installer.');
await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'node_modules/electron-builder/cli.js'),'--win','nsis','--x64','--prepackaged',program,'--config',path.join(root,'desktop/installer/builder.config.cjs'),'--publish','never'],{cwd:root,env:{...process.env,SYLVANA_WIZARD_INPUT:program,SYLVANA_WIZARD_OUTPUT:out,SYLVANA_WIZARD_VERSION:version,ELECTRON_BUILDER_CACHE:'F:/Sylvana/tool-cache/electron-builder',TEMP:out,TMP:out},windowsHide:true,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Wizard build failed ('+code+'). Inspect the retained candidate.')));});
const installer=path.join(out,isolated?'SylvanaSetup-Verification.exe':'SylvanaSetup.exe');
await writeFile(out+'/qualified-installer.json',JSON.stringify({success:true,format:'nsis-assisted',version,program,installer,installerSha256:await hash(installer),installerBytes:(await stat(installer)).size,imageSha256:await hash(program+'/resources/app.asar'),files:fileHashes,isolatedVerification:isolated,published:false},null,2));
console.log(JSON.stringify({built:true,version,installer,isolatedVerification:isolated,published:false}));
