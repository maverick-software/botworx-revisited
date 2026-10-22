import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,lstat,copyFile,link} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
desktopOperation('audit actual agent status and scoped report stopping in accepted57');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-agent-report-release57/current.json')),proof=await json(pointer.proof);assert(proof.success&&proof.version==='0.44.57');assert.equal(await hash(proof.image),proof.imageSha256);
let base=await json(proof.acceptedBase),accepted;for(let depth=0;depth<5;depth++){try{accepted=await json(path.join(base.out,'integrated-migration-accepted.json'));break;}catch(error){if(error.code!=='ENOENT')throw error;assert(base.acceptedBase);base=await json(base.acceptedBase);}}assert(accepted?.success);
const prior=await json(accepted.intent),previous=await json(prior.sourceEvidence),account=await json(prior.primaryAccountFile),out=path.join(proof.out,'status-audit-'+Date.now()),program=path.join(out,'private-program');await mkdir(program,{recursive:true});assert(!(await list(true)).includes(prior.distribution));
for(const name of await readdir(proof.program,{recursive:true})){const from=path.join(proof.program,name),to=path.join(program,name),info=await lstat(from);assert(!info.isSymbolicLink());if(info.isDirectory())await mkdir(to,{recursive:true});else{await mkdir(path.dirname(to),{recursive:true});if(['Agentopia.exe','resources/app.asar','resources/resources/runtime/config.toml'].includes(name.replaceAll('\\','/')))await copyFile(from,to);else await link(from,to);}}
const config=path.join(program,'resources/resources/runtime/config.toml');await copyFile(path.join(prior.assets,'runtime/config.toml'),config);
const cfg={...prior,out,program,exe:path.join(program,'Agentopia.exe'),assets:path.join(program,'resources/resources'),imageSha256:proof.imageSha256,temp:path.join(out,'temp')},profile=prior.target,marker=randomUUID().slice(0,8);assert(profile.startsWith('F:\\Agentopia-Data\\profiles\\c0e548ce-f913-4746-9e2e-9a466362c900\\'));
const evidence={success:false,out,at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,generatedAccountOnly:true,actualPostgreSQL:true,actualCodex:true,controlledModelResponses:true,liveProviderRequests:0,productionAccess:false,installed:false,checks:[],requests:[]},redact=s=>String(s).replaceAll(account.password,'[GENERATED PASSWORD]'),save=()=>writeFile(path.join(out,'evidence.json'),redact(JSON.stringify(evidence,null,2))),check=async name=>{evidence.checks.push(name);await save();console.log('PASS '+name);};
function helpers(application,page){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 const read=(table,columns,filters)=>application.evaluate(async(_,{table,columns,filters})=>{let query=globalThis.__coordination.broker.admin.from(table).select(columns);for(const [key,value]of Object.entries(filters))query=query.eq(key,value);const result=await query;if(result.error)throw Error(result.error.message);return result.data;},{table,columns,filters});
 const status=async id=>(await read('desktop_requests','status,error',{id}))[0];
 const finished=id=>expect.poll(async()=>{const row=await status(id);if(!row)return 'not saved yet';if(['failed','cancelled','interrupted'].includes(row.status))throw Error(row.error??row.status);return row.status;},{timeout:60000,intervals:[100,250,500]}).toBe('completed');
 const delivery=id=>application.evaluate((_,id)=>globalThis.__coordination.broker.agentReports.list(globalThis.__coordination.broker.currentOwner,id),id);
 const settled=id=>expect.poll(async()=>{const rows=await delivery(id);return rows[0]?.status??'missing';},{timeout:60000,intervals:[100,250,500]}).toBe('delivered');
 const held=key=>expect.poll(()=>application.evaluate((_,key)=>globalThis.__coordination.streams.has(key),key),{timeout:60000,intervals:[100,250,500]}).toBe(true);
 const release=key=>application.evaluate((_,key)=>globalThis.__coordination.streams.get(key).release(),key);
 const continuity=async()=>{assert.deepEqual(await call('agents.profile',{agentId:cfg.compact.agent}),previous.agentProfile);assert.deepEqual(await read('desktop_agent_memories','id,title,content',{agent_id:cfg.compact.agent}),previous.memories);assert.equal((await read('desktop_codex_turns','thread_id',{request_id:cfg.continuationRequestId}))[0].thread_id,cfg.sourceThread);await page.goto('agentopia://app/conversations/'+cfg.compact.conversation);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible({timeout:30000});for(const [label,extension]of [['Current Word54 '+cfg.marker,'docx'],['PDF54 '+cfg.marker,'pdf']]){await page.getByRole('link',{name:label,exact:true}).last().click();const frame=page.frameLocator('iframe[title="Formatted preview: Relocation-'+cfg.marker+'.'+extension+'"]');await expect(frame.locator(extension==='docx'?'section.docx':'canvas').first()).toBeVisible({timeout:30000});if(extension==='docx')await expect(frame.locator('table')).toHaveCount(1);}return {savedAgentDefinition:true,persistentMemory:true,nativeHistory:true,formattedWordAndPdf:true};};
 return {call,read,status,finished,delivery,settled,held,release,continuity};
}
const priorArgument=process.argv.find(value=>value.startsWith('--prior-evidence='))?.slice(17);if(priorArgument){assert(path.resolve(priorArgument).startsWith(path.resolve(proof.out)+path.sep));const priorRun=await json(priorArgument);assert(!priorRun.success&&priorRun.checks.length===1&&priorRun.imageSha256===proof.imageSha256);evidence.priorAttempt={file:priorArgument,requests:priorRun.requests,reason:'The verifier expected interrupted for an explicit Stop; the actual saved report correctly recorded cancelled. The failed fixture is retained; its terminal requests are inspected and are never reused.'};}
await save();
try{
 const {auditReportStatus}=await import('./agent-report-status57-workflow.mjs');
 const observed=await launchDurableProfileProbe(cfg,{testProfile:false,initialProfile:profile,expectedProfile:profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,label:'status-audit',redact,runReady:args=>auditReportStatus({...args,cfg,account,marker,evidence,save,check,helpers})});
 assert(observed.success&&observed.normalExit===0);evidence.success=true;await save();
}catch(error){evidence.error=redact(error.stack);evidence.cause=redact(error.cause?.stack??'');await save();process.exitCode=1;}
console.log(JSON.stringify({success:evidence.success,out,checks:evidence.checks.length,error:evidence.error,cause:evidence.cause}));
