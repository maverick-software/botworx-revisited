import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,cp,copyFile,readFile,writeFile,readdir,symlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createPackage,extractAll} from '@electron/asar';
import {build as viteBuild} from 'vite';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json} from './phased-backup-control.mjs';
import {patchVisible126} from './visible126-patch.mjs';
desktopOperation('prepare the focused Recents, transcript and native command indicator repair126');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),baseFile=(await json(path.join(root,'.supabase/desktop-computer-repair76/installed-current.json'))).proof,base=await json(baseFile),uiBase=await json('F:/Agentopia/.supabase/desktop-computer-repair76/1792778909684/proof.json'),out=path.join(root,'.supabase/desktop-visible126','candidate-'+Date.now()),source=path.join(out,'source/desktop'),resources=path.join(out,'resources'),packageRoot=path.join(out,'package');
assert(base.success&&base.version==='0.44.75');assert.equal(await hash(base.image),base.imageSha256);assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.75/resources/app.asar'),base.imageSha256);await mkdir(source,{recursive:true});
for(const name of['package.json','tsconfig.json','vite.config.mjs','presentation-renderer-patch.mjs'])await copyFile(path.join(uiBase.source,name),path.join(source,name));
await cp(path.join(base.source,'src'),path.join(source,'src'),{recursive:true,errorOnExist:true});await cp(path.join(uiBase.source,'ui'),path.join(source,'ui'),{recursive:true,errorOnExist:true});await symlink(path.join(root,'node_modules'),path.join(out,'source/node_modules'),'junction');
await patchVisible126(source);
const e={success:false,out,source,sourceHashes:{},version:'0.44.75',revision:'recents-transcript-native-indicator126',previousCandidate:baseFile,baseProof:base.baseProof,baseImageSha256:base.imageSha256,providerRequests:0,installed:false,fullGoalComplete:false,draftPreviewSourceExcluded:true,schemaUnchanged:73,commands:[]};
async function command(name,args){try{const result=await exec(process.execPath,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1024*1024,env:{...process.env,AGENTOPIA_VISIBLE_BUILD:path.join(source,'build')}});await writeFile(path.join(out,name+'.log'),result.stdout+result.stderr);e.commands.push({name,success:true});return result.stdout;}catch(error){await writeFile(path.join(out,name+'.log'),String(error.stdout??'')+String(error.stderr??''));throw error;}}
async function inventory(directory){const found={};for(const entry of await readdir(directory,{recursive:true,withFileTypes:true})){assert(!entry.isSymbolicLink());if(entry.isFile()){const file=path.join(entry.parentPath,entry.name);found[path.relative(directory,file).replaceAll('\\','/')]=await hash(file);}}return found;}
try{
 await command('backend-types',['node_modules/typescript/bin/tsc','-p',path.join(source,'tsconfig.json'),'--noEmitOnError']);await command('interface-types',['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')]);
 await writeFile(path.join(source,'build/package.json'),'{"type":"commonjs"}');
 const test=await command('native-command-controls',['--test','--test-reporter=tap','desktop/tests/native-command-indicator126.test.cjs']);e.nativeCommandCases=Number(test.match(/^# pass (\d+)/m)?.[1]);assert.equal(e.nativeCommandCases,7);
 const ui=path.join(resources,'ui');await viteBuild({configFile:path.join(source,'vite.config.mjs'),logLevel:'error',build:{outDir:ui}});
 extractAll(base.image,packageRoot);for(const name of['main.js','codex-harness.js','computer-indicator.js'])await copyFile(path.join(source,'build',name),path.join(packageRoot,'build',name));
 const image=path.join(out,'app.asar');await createPackage(packageRoot,image);const compiled=await inventory(path.join(packageRoot,'build')),changed=Object.keys(compiled).filter(name=>compiled[name]!==base.compiled[name]).sort();assert.deepEqual(changed,['codex-harness.js','computer-indicator.js','main.js']);
 for(const file of['src/codex-harness.ts','src/computer-indicator.ts','src/main.ts','ui/WorkspaceViews.tsx','ui/NativeTurn.tsx','ui/SidebarSection.tsx'])e.sourceHashes[file]=await hash(path.join(source,file));
 Object.assign(e,{image,imageSha256:await hash(image),packageRoot,compiled,changedCompiled:changed,ui,uiFiles:await inventory(ui),resources,helperManifest:base.helperManifest,actualArchivedModules:true,controlsPassed:7,includedSourceChanges:Object.keys(e.sourceHashes),sourceGuardOnly:false,controllerSha256:await hash(import.meta.filename),patchSha256:await hash(path.join(root,'scripts/desktop/visible126-patch.mjs'))});e.success=true;
}catch(error){e.error=error.stack;process.exitCode=1;}
await writeFile(path.join(out,'proof.json'),JSON.stringify(e,null,2));if(e.success)await writeFile(path.join(root,'.supabase/desktop-visible126/current.json'),JSON.stringify({proof:path.join(out,'proof.json')},null,2));console.log(JSON.stringify({success:e.success,out,imageSha256:e.imageSha256,changedCompiled:e.changedCompiled,error:e.error?.slice(-1800)}));
