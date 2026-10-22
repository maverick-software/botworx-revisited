// Real packaged app and retained generated account/runtime; zero model turns.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,lstat,copyFile,link} from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
desktopOperation('verify packaged55 saved agent and document continuity');
const root=path.resolve(import.meta.dirname,'../..'),proof=await json((await json(path.join(root,'.supabase/desktop-plugin-release55/current.json'))).proof),base=await json(proof.acceptedBase),accepted=await json(path.join(base.out,'integrated-migration-accepted.json')),prior=await json(accepted.intent),previous=await json(prior.sourceEvidence),account=await json(prior.primaryAccountFile);
assert(proof.success&&proof.version==='0.44.55'&&accepted.success);assert.equal(await hash(proof.image),proof.imageSha256);assert(!(await list(true)).includes(prior.distribution));
const out=path.join(proof.out,'packaged-'+Date.now());await mkdir(out);
// This retained generated runtime owns a separate port range. Keep its exact
// existing template while testing the unchanged delivered .55 application.
const program=path.join(out,'private-program');await mkdir(program);
for(const name of await readdir(proof.program,{recursive:true})){const from=path.join(proof.program,name),to=path.join(program,name),info=await lstat(from);assert(!info.isSymbolicLink());if(info.isDirectory())await mkdir(to,{recursive:true});else{await mkdir(path.dirname(to),{recursive:true});if(['Agentopia.exe','resources/app.asar','resources/resources/runtime/config.toml'].includes(name.replaceAll('\\','/')))await copyFile(from,to);else await link(from,to);}}
const config=path.join(program,'resources/resources/runtime/config.toml');await copyFile(path.join(prior.assets,'runtime/config.toml'),config);
await writeFile(path.join(out,'private-port-configuration.json'),JSON.stringify({generatedOnly:true,configuration:config,sha256:await hash(config),source:path.join(prior.assets,'runtime/config.toml'),applicationImageUnchanged:await hash(path.join(program,'resources/app.asar'))===proof.imageSha256}));
const cfg={...prior,out,program,exe:path.join(program,'Agentopia.exe'),assets:path.join(program,'resources/resources'),imageSha256:proof.imageSha256,temp:path.join(out,'temp')},profile=prior.target;
assert(profile.startsWith('F:\\Agentopia-Data\\profiles\\c0e548ce-f913-4746-9e2e-9a466362c900\\'));
const e={success:false,out,version:proof.version,imageSha256:proof.imageSha256,generatedAccountOnly:true,productionAccess:false,modelTurns:0,realProviderRequests:0,checks:[]},save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2)),redact=s=>String(s).replaceAll(account.password,'[GENERATED PASSWORD]');
async function inspect({application,page},cold){
 assert.equal(await application.evaluate(({app})=>app.getVersion()),'0.44.55');
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});let identity=(await call('auth.state')).identity;if(!identity){await call('auth.signIn',{email:account.email,password:account.password});await page.reload();identity=(await call('auth.state')).identity;}assert.equal(identity.id,cfg.owner);
 assert.deepEqual(await call('agents.profile',{agentId:cfg.compact.agent}),previous.agentProfile);
 const records=await application.evaluate(async(_,cfg)=>{const broker=globalThis.__coordination.broker,memories=await broker.admin.from('desktop_agent_memories').select('id,title,content').eq('agent_id',cfg.compact.agent),thread=await broker.admin.from('desktop_codex_turns').select('thread_id').eq('request_id',cfg.continuationRequestId).single();if(memories.error||thread.error)throw Error('Saved agent rows unavailable');return {memories:memories.data,thread:thread.data.thread_id};},cfg);assert.deepEqual(records.memories,previous.memories);assert.equal(records.thread,cfg.sourceThread);
 await page.goto('agentopia://app/conversations/'+cfg.compact.conversation);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible({timeout:30000});
 for(const [label,extension]of [['Current Word54 '+cfg.marker,'docx'],['PDF54 '+cfg.marker,'pdf']]){await page.getByRole('link',{name:label,exact:true}).last().click();const frame=page.frameLocator('iframe[title="Formatted preview: Relocation-'+cfg.marker+'.'+extension+'"]');await expect(frame.locator(extension==='docx'?'section.docx':'canvas').first()).toBeVisible({timeout:30000});if(extension==='docx')await expect(frame.locator('table')).toHaveCount(1);}
 await page.getByRole('button',{name:'Plugins and connections',exact:true}).click();await expect(page.getByRole('navigation',{name:'Customize',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Plugins',exact:true})).toBeVisible();await expect(page.locator('.workspace-pane')).toBeHidden();await expect(page.getByRole('tab',{name:'Public',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Agent tools',exact:true})).toHaveCount(0);
 await page.screenshot({path:path.join(out,cold?'cold-plugins.png':'plugins.png')});
 await page.getByRole('navigation',{name:'Customize',exact:true}).getByRole('button',{name:'Tools',exact:true}).click();await expect(page.getByRole('heading',{name:'Tools',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Agent tools',exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'Customize',exact:true}).getByRole('button',{name:'Skills',exact:true}).click();await expect(page.getByRole('heading',{name:'Skills',exact:true})).toBeVisible();await page.getByRole('button',{name:'Chats',exact:true}).click();await expect(page.locator('.workspace-pane')).toBeVisible();await expect(page.frameLocator('iframe[title="Formatted preview: Relocation-'+cfg.marker+'.pdf"]').locator('canvas').first()).toBeVisible({timeout:30000});
 assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),0);return {savedAccount:true,agentDefinitionAndMemoryPreserved:true,savedNativeThreadPreserved:true,formattedWordAndPdf:true,separateCustomizePages:true,modelTurns:0};
}
try{
 for(const cold of [false,true]){const result=await launchDurableProfileProbe(cfg,{testProfile:false,initialProfile:profile,expectedProfile:profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,redact,label:cold?'cold-reopen':'first-open',runReady:({application,page})=>inspect({application,page},cold)});assert(result.success&&result.normalExit===0);e.checks.push({cold,evidence:path.join(result.out,'evidence.json'),...result.workflow});await save();console.log('PASS '+(cold?'Cold reopening':'First packaged opening')+' preserves generated saved agent state, native history, formatted documents and separate Plugins/Tools/Skills pages.');}
 e.success=true;await save();await writeFile(path.join(proof.out,'packaged-accepted.json'),JSON.stringify({success:true,version:proof.version,imageSha256:proof.imageSha256,evidence:path.join(out,'evidence.json'),coldReopening:true,agentContinuity:true,formattedDocuments:true,realProviderRequests:0},null,2),{flag:'wx'});
}catch(error){e.error=redact(error.stack);e.cause=redact(error.cause?.stack??'');await save();process.exitCode=1;}
console.log(JSON.stringify({success:e.success,out,checks:e.checks.length,error:e.error,cause:e.cause}));
