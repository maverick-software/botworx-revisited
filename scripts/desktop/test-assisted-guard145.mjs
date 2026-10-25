import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
import {installAssistedCommand145} from './assisted-endurance145-guard.mjs';
desktopOperation('qualify read-only native calculator scope with synthetic approvals and no command execution');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-endurance145');await mkdir(out,{recursive:true});const checks=[];
async function fixture({foreignOwner=false,foreignCwd=false,changedHelper=false,missingSnapshot=false,patch=false,duplicate=false,badCommand=false,wrapped=false}={}){
 const cwd='F:/Generated-Endurance145',script=path.join(cwd,'reconcile145.py'),csv=path.join(cwd,'batch-01.csv'),helperBytes=Buffer.from('synthetic reviewed helper'),sourceBytes=Buffer.from('synthetic approved source'),digest=value=>crypto.createHash('sha256').update(value).digest('hex');
 const scope={agent:'agent',baseUrl:'http://127.0.0.1/generated',tabs:['tab'],nativeHelper:{cwd,script,sha256:digest(helperBytes),sources:{'batch-01.csv':digest(sourceBytes)},count:99,shellPrefix:'"generated-shell"'}};
 const state={leaseActive:true,owner:'owner',cases:{request:scope},goalCases:{},blocked:[],out:null,tools:[{requestId:'request',name:'browser_open',status:'completed',arguments:{url:scope.baseUrl+'/stage1'},finishedAt:'2026-10-24T00:00:00.000Z'},...(!missingSnapshot?[{requestId:'request',name:'browser_snapshot',status:'completed',arguments:{tab_id:'tab'},at:'2026-10-24T00:00:01.000Z'}]:[])]};let executed=0;
 class Harness{async serverRequest(){executed++;return {decision:'accept'};}}
 const context=vm.createContext({Date,JSON,Error,__validation76:state,__durableProbeRequire:name=>name==='node:fs'?{lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false}),readFileSync:file=>file===script?(changedHelper?Buffer.from('changed'):helperBytes):file===csv?sourceBytes:assert.fail('Unexpected file'),writeFileSync:()=>{}}:name==='node:path'?path:name==='node:crypto'?crypto:name.endsWith('/build/codex-harness.js')?{CodexHarness:Harness}:assert.fail('Unexpected import')});
 await installAssistedCommand145({evaluate:(fn)=>vm.runInContext('('+fn.toString()+')',context)({app:{getAppPath:()=>'/fixture'}})});
 if(duplicate)state.helperCommands145.push({agent:'agent',stage:1});
 const record={owner:foreignOwner?'foreign':'owner',request:{id:'request',agent_id:'agent'},options:{goalId:'goal'}},command=badCommand?'python reconcile145.py 1 0 0; Write-Output extra':wrapped?'"generated-shell" -Command "python reconcile145.py 1 0 0"':'python reconcile145.py 1 0 0';
 try{await new Harness().serverRequest(record,{method:patch?'item/fileChange/requestApproval':'item/commandExecution/requestApproval',params:{cwd:foreignCwd?'F:/Other':cwd,command}});return {executed,state};}catch(error){return {error,executed,state};}
}
for(const[description,options]of [['foreign owner',{foreignOwner:true}],['different working folder',{foreignCwd:true}],['changed helper',{changedHelper:true}],['unread source',{missingSnapshot:true}],['native file patch',{patch:true}],['duplicate invocation',{duplicate:true}],['extra shell operation',{badCommand:true}]]){const r=await fixture(options);assert(r.error,description);assert.equal(r.executed,0);checks.push(description+' refused before native execution.');}
for(const wrapped of [false,true]){const r=await fixture({wrapped});assert(!r.error);assert.equal(r.executed,1);assert.equal(r.state.helperCommands145.length,1);assert(r.state.helperCommands145[0].beforeExecution);checks.push((wrapped?'Qualified shell-wrapped':'Direct')+' helper accepted once after source and hash verification.');}
await writeFile(path.join(out,'command-guard-qualification.json'),JSON.stringify({success:true,at:new Date().toISOString(),checks,realCommands:0,providerRequests:0,sourceSha256:await hash(path.join(root,'scripts/desktop/assisted-endurance145-guard.mjs'))},null,2));console.log(JSON.stringify({success:true,checks:checks.length,realCommands:0,providerRequests:0}));
