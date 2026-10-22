import {_electron,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('installed Windows action review and retained history');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,process.env.AGENTOPIA_COMPUTER_REVIEW_OUTPUT??'.supabase/desktop-computer-review/installed');await mkdir(out,{recursive:true});
const proof=JSON.parse(await readFile(path.join(root,'.supabase/desktop-computer-stream/live-installed/evidence.json'),'utf8')),version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
assert(proof.success);assert(process.env.AGENTOPIA_LIVE_EXE,'Set AGENTOPIA_LIVE_EXE to the installed application.');
const evidence={at:new Date().toISOString(),version,inference:false,retainedLiveProofVersion:proof.version};let app,page,owner,location,preferences;
const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
try{
 const env={...process.env,AGENTOPIA_TEST_PROFILE:''};for(const key of Object.keys(env))if(key.toLowerCase()==='path')delete env[key];env.Path=[process.env.SYSTEMROOT+'\\System32',process.env.SYSTEMROOT,process.env.SYSTEMROOT+'\\System32\\Wbem'].join(';');
 app=await _electron.launch({executablePath:process.env.AGENTOPIA_LIVE_EXE,args:[],cwd:os.tmpdir(),env,timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(30000);await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:240000});
 const actual=await app.evaluate(({app})=>({version:app.getVersion(),packaged:app.isPackaged}));assert(actual.packaged&&actual.version===version);owner=(await call('auth.state')).identity.id;assert.equal(owner,proof.ownerId);location=await call('navigation.state',{owner});preferences=await call('preferences.get');
 await app.evaluate(()=>{const real=globalThis.fetch;globalThis.reviewInference=0;globalThis.restoreReviewFetch=()=>globalThis.fetch=real;globalThis.fetch=async(input,...args)=>{if(/\/responses(?:\?|$)|chat\/completions/.test(String(input))){globalThis.reviewInference++;throw new Error('Installed history review excludes inference.');}return real(input,...args);};});
 assert.equal((await call('native.active')).length,0);assert.equal((await call('computer.status')).selected,0);const providers=await call('providers.status');assert(providers.openrouter&&providers.chatgpt?.authorized);
 const profile=await app.evaluate(({app})=>({exe:process.getBuiltinModule('node:fs').realpathSync.native(app.getPath('exe')),appData:app.getPath('appData'),userData:app.getPath('userData'),sessionData:app.getPath('sessionData')}));
 const {packageCacheProfile}=await import(pathToFileURL(path.join(root,'desktop/build/desktop-profile.js')).href);const expectedProfile=packageCacheProfile(profile.exe,profile.appData);if(expectedProfile){assert.equal(profile.userData,expectedProfile);assert.equal(profile.sessionData,expectedProfile);}evidence.profile=profile;
 await app.evaluate(({dialog},directory)=>{const original=dialog.showOpenDialog;globalThis.restoreProfilePicker=()=>dialog.showOpenDialog=original;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},profile.userData);
 await assert.rejects(call('files.pick',{kind:'folder'}),/application and credential storage cannot be attached/);await app.evaluate(()=>globalThis.restoreProfilePicker());evidence.canonicalProfileIsProtectedFromFileSharing=true;
 const rows=await call('messages.list',{conversationId:proof.conversationId});assert(rows.length>=4);const tools=rows.filter(row=>row.role==='assistant'&&[proof.firstRequestId,proof.secondRequestId].includes(row.metadata.timing?.requestId)).flatMap(row=>row.metadata.tools??[]).filter(t=>t.approval?.preview?.kind==='computer');assert.equal(tools.length,8);
 for(const tool of tools)await assert.rejects(call('computer.preview',{id:tool.approval.preview.snapshotId}),/expired|revoked/);
 await page.goto('agentopia://app/conversations/'+proof.conversationId);await expect(page.locator('.message.assistant').last()).toBeVisible();const previous=page.locator('.previous-messages-toggle');if(await previous.count()&&await previous.getAttribute('aria-expanded')==='false')await previous.click();
 for(const turn of await page.locator('.message.assistant .turn-work-toggle').all())if(await turn.getAttribute('aria-expanded')==='false')await turn.click();
 const reviews=page.locator('.tool-activity').filter({has:page.locator('.computer-action-review')});await expect(reviews).toHaveCount(8);
 for(let index=0;index<8;index++){
  const review=reviews.nth(index),tool=tools[index];await review.locator(':scope>summary').click();await expect(review.getByRole('region',{name:'Windows input review'})).toBeVisible();await expect(review.getByLabel('Windows input arguments')).toBeHidden();await expect(review.locator('.computer-input-preview')).toHaveCount(0);await expect(review.getByRole('button',{name:'Approve tool call',exact:true})).toHaveCount(0);await expect(review.locator('.computer-review-context')).toContainText(tool.approval.arguments.window);
  if(tool.name==='computer_type')await expect(review.getByLabel('Exact text to type',{exact:true})).toHaveText(tool.approval.arguments.text);
  if(tool.name==='computer_key')await expect(review.locator('kbd')).toHaveText(tool.approval.arguments.key);
  await expect(review.locator('.computer-review-consequence')).toHaveText('Recorded input for this turn. See the result below.');await expect(review.locator('.computer-result>strong')).toHaveText('Input sent');await expect(review.getByLabel('Windows result metadata')).toHaveCount(0);await expect(review.getByRole('button',{name:'View Window after input',exact:true})).toBeVisible();
  await review.locator(':scope>summary').click();
 }
 evidence.allEightRealProviderActionsReadable=true;evidence.expiredGrantsCannotReplay=true;
 const typing=reviews.filter({has:page.locator('.computer-review-text')}).first();await typing.locator(':scope>summary').click();await typing.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'retained-unicode-review.png'),animations:'disabled'});
 await typing.getByText('Technical details',{exact:true}).click();await expect(typing.getByLabel('Windows input arguments')).toContainText('café');await typing.getByText('Technical details',{exact:true}).click();evidence.exactTextAndTechnicalDisclosure=true;
 await typing.getByText('Technical result',{exact:true}).click();await expect(typing.getByLabel('Windows result metadata')).toContainText('"sent": true');await typing.getByText('Technical result',{exact:true}).click();await expect(typing.getByLabel('Windows result metadata')).toHaveCount(0);evidence.compactActualInputResultsAndSavedScreenshots=true;
 assert.deepEqual(await call('messages.list',{conversationId:proof.conversationId}),rows);await page.reload();await expect(page.locator('.message.assistant').last()).toBeVisible();assert.deepEqual(await call('messages.list',{conversationId:proof.conversationId}),rows);assert.equal((await call('native.active')).length,0);assert.equal(await app.evaluate(()=>globalThis.reviewInference),0);
 evidence.bothConnectionsAndAllSavedMessagesRetained=true;evidence.noInferenceOrInputResumed=true;evidence.success=true;console.log('PASS installed action review: eight retained actual ChatGPT/OpenRouter inputs display readable actions, exact Unicode/keys and optional arguments; expired grants cannot replay, both connections and saved history survive reload. No inference repeated.');
}catch(error){evidence.error=error.message;if(page)await page.screenshot({path:path.join(out,'failure.png'),animations:'disabled'}).catch(()=>{});throw error;}finally{
 if(app){await app.evaluate(()=>globalThis.restoreReviewFetch?.()).catch(()=>{});if(preferences)await call('preferences.save',{userId:owner,preferences}).catch(()=>{});if(location){await call('navigation.save',{owner,state:location}).catch(()=>{});const route=location.view!=='chat'?'/'+location.view:location.conversationId?'/conversations/'+location.conversationId:'/chats';await page.goto('agentopia://app'+route).catch(()=>{});}await app.close().catch(()=>{});}await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
}
