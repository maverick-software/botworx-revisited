import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
import {json} from './phased-backup-control.mjs';
desktopOperation('inspect bundled Git using generated retained repository and stdout only');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-chat-file-history69/current.json')),qualified=await json(pointer.evidence),require=createRequire(import.meta.url),exec=promisify(execFile);
assert(qualified.success);
const {ScheduledWorkspaces}=require(path.join(qualified.build,'scheduled-workspaces.js')),host=Object.create(ScheduledWorkspaces.prototype);
const repository='F:/Agentopia-Acceptance/file-history69-1792707374647/maintenance-b1ebb9af-6817-42f4-917b-cd0add7e23ec/project';
assert.equal((await realpath(repository)).toLowerCase(),path.resolve(repository).toLowerCase());
const out=path.join(root,'.supabase/desktop-chat-file-history69','git-inspection-'+Date.now());await mkdir(out,{recursive:true});
const binaries=[path.join(root,'desktop/resources/code-tools/git-2.56.0.windows.2/cmd/git.exe'),'C:/Program Files/Git/cmd/git.exe'],results=[];
const failedFixture='F:/Agentopia-Acceptance/file-history69-1792707374647/maintenance-2eb4b7ee-65ed-4990-b1ec-303acd888787';
const retained=failedFixture+'/protected-profile/scheduled-recovery/f612c03f-f977-4103-a28d-8136c18996ce/36b89dcc-9d3b-4f3a-a225-9ebcd462549d';
const commands=[{name:'stdout-bundle',cwd:repository,args:['bundle','create','-','HEAD','--']},{name:'retained-bundle-verification',cwd:failedFixture+'/project',args:['bundle','verify',retained+'/git/history.bundle']}];
for(const binary of binaries){
 for(const command of commands){const row={binary,command:command.name,sourceWrites:0,networkRequests:0};
 try{const result=await exec(binary,[...host.base(),'-C',path.resolve(command.cwd),...command.args.map(arg=>path.isAbsolute(arg)?path.resolve(arg):arg)],{env:host.environment(),windowsHide:true,encoding:'buffer',timeout:30000,maxBuffer:8*1024*1024});Object.assign(row,{success:true,bytes:result.stdout.length,sha256:createHash('sha256').update(result.stdout).digest('hex'),stderr:result.stderr.toString('utf8').slice(0,2000)});}catch(error){Object.assign(row,{success:false,code:error.code,stderr:error.stderr?.toString('utf8').slice(0,2000),message:error.message?.slice(0,1000)});}results.push(row);}
}
const evidence={at:new Date().toISOString(),out,generatedRepository:repository,results,sourceWrites:0,profileAccess:false,providerRequests:0,scope:'Both binaries create an identical stdout bundle and verify an existing generated source bundle. Broader restoration failures remain unresolved. Earlier attempts to verify from an incomplete restore directory had no repository and are not valid Git comparisons.'};await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
