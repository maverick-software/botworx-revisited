import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('reproduce selected-skill capture scanning a larger unrelated catalog');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-draft-preview76','catalog108-probe-'+Date.now()),temp=path.join('F:/Agentopia-Acceptance','catalog108-probe-'+Date.now()),build=path.join(root,'.supabase/desktop-draft-preview76/source-1792811967269/build');await mkdir(out,{recursive:true});await mkdir(temp,{recursive:true});
let output='';const child=spawn(process.execPath,['--test','--test-reporter=tap','desktop/tests/preview-workspace-skills.test.cjs'],{cwd:root,windowsHide:true,env:{...process.env,AGENTOPIA_PREVIEW_BUILD:build,TEMP:temp,TMP:temp,TMPDIR:temp}});for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>output+=bytes);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await writeFile(path.join(out,'probe.log'),output);const reproduced=code!==0&&output.includes('Workspace skills contain too many bundled files.');await writeFile(path.join(out,'evidence.json'),JSON.stringify({success:reproduced,verifiedReproduction:reproduced,build,testSha256:await hash(path.join(root,'desktop/tests/preview-workspace-skills.test.cjs')),sourceSha256:await hash(path.join(root,'desktop/src/preview-workspace-skills.ts')),testExitCode:code,providerRequests:0,productionAccess:false},null,2));assert(reproduced,output.slice(-2000));console.log(JSON.stringify({success:true,out,verifiedReproduction:true}));
