import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,lstat,copyFile,link} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {hash,list,registration} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
desktopOperation('qualify revised packaged Storage close ordering and retained restored state');
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const pointer=await json(path.join(root,'.supabase/desktop-release-04450/current.json')),proof=await json(pointer.proof);
const oldOut=path.join(root,'.supabase/desktop-release-04450/1792541639365'),oldProof=await json(path.join(oldOut,'package-proof.json')),oldCold=await json(path.join(oldOut,'capability8-restore-accepted.json'));
assert(oldCold.success&&proof.out!==oldOut&&proof.success);
for(const [name,digest]of Object.entries(oldProof.compiled))if(name!=='main.js')assert.equal(proof.compiled[name],digest,'Unexpected compiled change: '+name);
assert(proof.compiled['storage-control.js']);
const oldCfg=await json(path.join(oldOut,'capability8-restore/1792542915243/intent.json')),prior=await json(path.join(oldCfg.out,'app-acceptance-1792542990273/evidence.json')),source=await json(oldCfg.sourceEvidence);
const entry=await registration(oldCfg.distribution);assert.equal(path.win32.normalize(entry.path.replace(/^\\\\\?\\/,'' )).toLowerCase(),oldCfg.storage.toLowerCase());assert(oldCfg.distribution!==oldCfg.production);
assert(!(await list(true)).includes(oldCfg.distribution),'The prior owned app must have completed normal shutdown.');
const out=path.join(proof.out,'storage-close-acceptance',String(Date.now())),program=path.join(out,'program');await mkdir(out,{recursive:true});
for(const name of await readdir(proof.program,{recursive:true})){
 const from=path.join(proof.program,name),to=path.join(program,name),info=await lstat(from);assert(!info.isSymbolicLink());
 if(info.isDirectory())await mkdir(to,{recursive:true});else if(info.isFile()){await mkdir(path.dirname(to),{recursive:true});if(name.replaceAll('\\','/')==='resources/resources/runtime/config.toml')await copyFile(oldCfg.configFile,to);else await link(from,to);}
}
const cfg={...oldCfg,out,program,exe:path.join(program,'Agentopia.exe'),assets:path.join(program,'resources/resources'),configFile:path.join(program,'resources/resources/runtime/config.toml'),sourceProof:pointer.proof,imageSha256:proof.imageSha256,temp:path.join(out,'temp')};
assert.equal(await hash(cfg.configFile),oldCfg.testConfigSha256);assert.equal(await hash(path.join(program,'resources/app.asar')),proof.imageSha256);await writeFile(path.join(out,'intent.json'),JSON.stringify(cfg,null,2),{flag:'wx'});
const generated=randomUUID(),observation=path.join(out,'close-order.json'),report={success:false,at:new Date().toISOString(),out,version:proof.version,imageSha256:proof.imageSha256,generatedChat:generated,providerRequests:0,ordinaryDataChanged:false,retainedRestoration:oldCold,checks:[]};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));await save();
const options={testProfile:false,initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true};
async function retained({application,page}){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 assert.equal((await call('auth.state')).identity.id,source.owner);assert.deepEqual(await call('notifications.preferences.get'),{completion:'always',permissions:false,questions:true,tasks:false});
 await page.goto('agentopia://app/conversations/'+source.conversation);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(prior.laterDraft,{timeout:30000});await expect(page.getByText('Resumed native history '+source.marker,{exact:true})).toBeVisible();
 assert.equal((await call('workspace.state',{scope:source.conversation})).active,source.expectedPane.tab);
 assert.equal((await application.evaluate(()=>globalThis.__coordination.calls)).length,0);return call;
}
try{
 const first=await launchDurableProfileProbe(cfg,{...options,label:'close-during-cleanup',runReady:async context=>{
  const {application,page}=context,call=await retained(context);
  await application.evaluate(async(_,{owner,id})=>{const b=globalThis.__coordination.broker,r=await b.admin.from('conversation_sessions').insert({conversation_id:id,user_id:owner,title:'Disposable close-order acceptance',session_state:{desktop:true}});if(r.error)throw Error(r.error.message);},{owner:source.owner,id:generated});
  const review=await call('storage.prepareChats',{owner:source.owner,ids:[generated]});
  await application.evaluate((electron,{owner,id,destination})=>{
   const b=globalThis.__coordination.broker,fs=globalThis.__durableProbeRequire('node:fs'),w=electron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('agentopia://app/')),record={events:[],warnings:0,held:false,deleted:false},write=()=>fs.writeFileSync(destination,JSON.stringify(record,null,2));
   const host=b.storageState.host,original=host.deleteChat;let release;const pending=new Promise(resolve=>release=resolve);
   host.deleteChat=async(actualOwner,actualId)=>{if(actualOwner!==owner||actualId!==id)throw Error('Cleanup fixture escaped its generated scope');record.held=true;record.events.push('cleanup-held');write();await pending;await original(actualOwner,actualId);record.deleted=true;record.events.push('cleanup-deleted');write();};
   const send=w.webContents.send.bind(w.webContents);w.webContents.send=(channel,...args)=>{if(channel==='agentopia:before-close'){record.draftWhileLocked=b.backingUp;record.events.push('draft-save');write();}return send(channel,...args);};
   const message=electron.dialog.showMessageBox.bind(electron.dialog);electron.dialog.showMessageBox=(...args)=>{if(args.some(value=>value?.title==='Drafts still saving')){record.warnings++;write();return Promise.resolve({response:0});}return message(...args);};
   w.once('close',()=>{record.events.push('close-request');write();setTimeout(()=>{record.waitedBeforeDraft=!record.events.includes('draft-save')&&record.held&&!record.deleted;record.events.push('release-cleanup');write();release();},400);});write();
  },{owner:source.owner,id:generated,destination:observation});
  await page.evaluate(({owner,id})=>{globalThis.__closeCleanup=window.agentopia.call('storage.commitChats',{owner,id});void globalThis.__closeCleanup.catch(()=>{});},{owner:source.owner,id:review.id});
  await expect.poll(async()=>(await json(observation)).held).toBe(true);return {generatedChatOnly:true,cleanupPendingAtNormalClose:true};
 }});
 assert.equal(first.normalExit,0);assert.deepEqual(first.controlledNetwork.calls,[]);const order=await json(observation);assert(order.waitedBeforeDraft&&order.deleted);assert.equal(order.draftWhileLocked,false);assert.equal(order.warnings,0);assert(order.events.indexOf('cleanup-deleted')<order.events.indexOf('draft-save'));report.closeOrder=order;report.firstNormalExit=first.normalExit;report.checks.push('The exact revised package waits for admitted generated-chat cleanup before draft saving, then closes normally without a false warning.');await save();
 assert(!(await list(true)).includes(cfg.distribution));
 const cold=await launchDurableProfileProbe(cfg,{...options,label:'cold-after-storage-close',runReady:async context=>{const call=await retained(context);const data=await call('storage.summary',{owner:source.owner});assert(!data.chats.some(row=>row.id===generated));assert(data.chats.some(row=>row.id===source.conversation));return {savedStateRetained:true,generatedDeletionConfirmed:true,inferenceReplay:false};}});
 assert.equal(cold.normalExit,0);assert.deepEqual(cold.controlledNetwork.calls,[]);report.coldNormalExit=cold.normalExit;report.checks.push('Cold reopening retains the account, notification choices, completed reply, later draft and document tab, confirms only the generated chat was removed, and exits normally without inference.');report.success=true;await save();
 const oldUpgrade=await json(path.join(oldOut,'database-upgrade-accepted.json'));
 await writeFile(path.join(proof.out,'database-upgrade-accepted.json'),JSON.stringify({...oldUpgrade,at:new Date().toISOString(),imageSha256:proof.imageSha256,evidence:path.join(out,'evidence.json'),unchangedUpgradeAndSettingsEvidence:oldUpgrade.evidence,unchangedUpgradeIntent:path.join(oldOut,'upgrade-acceptance/intent.json'),additionalMainCloseOrderingPassed:true,unchangedCompiledModulesVerified:true,ordinaryInstallerUpgradeStillPending:true},null,2),{flag:'wx'});
 await writeFile(path.join(proof.out,'capability8-restore-accepted.json'),JSON.stringify({success:true,at:new Date().toISOString(),out,evidence:path.join(out,'evidence.json'),sourceBundle:cfg.sourceBundle,sameWindowsUser:true,providerRequests:0,retainedRestoration:oldCold,exactRevisedPackageColdReopeningPassed:true,freshWindowsUserAcceptancePending:true,ordinaryProductionAcceptancePending:true},null,2),{flag:'wx'});
 console.log(JSON.stringify({success:true,out,checks:report.checks.length,providerRequests:0}));
}catch(error){report.error=error.stack;if(error.cause)report.cause=error.cause.stack;await save();console.error(error.stack);if(error.cause)console.error(error.cause.stack);process.exitCode=1;}
