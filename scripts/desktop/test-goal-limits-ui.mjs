import {_electron,expect} from '@playwright/test';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-goal-limits/ui-'+Date.now()),require=createRequire(import.meta.url);
await mkdir(out,{recursive:true});
const saved={id:'11111111-1111-4111-8111-111111111111',agent_id:'22222222-2222-4222-8222-222222222222',conversation_id:null,
 objective:'Finish the selected workspace and verify the result',status:'paused',max_turns:null,token_budget:40000,turns_used:12,note:null};
await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {GoalDialog} from './desktop/ui/GoalDialog';import './desktop/ui/style.css';function Fixture(){const [open,setOpen]=useState(true),[initial,setInitial]=useState(null);window.goalLimitsFixture={reset:(editing=false)=>{setInitial(editing?${JSON.stringify(saved)}:null);setOpen(false);setTimeout(()=>setOpen(true),0);}};return <main>{open?<GoalDialog initial={initial} goals={[${JSON.stringify(saved)}]} agents={[{id:${JSON.stringify(saved.agent_id)},name:'Workspace assistant'}]} select={async()=>{}} save={async(value)=>{await window.goalLimitsBridge.save(value);}} close={()=>setOpen(false)}/>:<p>Goal settings saved</p>}</main>;}createRoot(document.getElementById('root')).render(<Fixture/>);`,resolveDir:root,sourcefile:'goal-limits-ui-fixture.tsx',loader:'tsx'},outfile:path.join(out,'fixture.js'),bundle:true,platform:'browser',format:'iife',logLevel:'silent'});
await writeFile(path.join(out,'index.html'),'<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><style>html,body,#root{min-height:100vh;background:var(--bg,#1b1b1b)}</style><link rel="stylesheet" href="fixture.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>');
await writeFile(path.join(out,'preload.cjs'),"const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('goalLimitsBridge',{save:value=>ipcRenderer.invoke('goal-limits-save',value)});");
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow,ipcMain}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});global.saves=[];global.failSave=false;ipcMain.handle('goal-limits-save',(_,value)=>{if(failSave)throw Error('The goal changed. Reopen its settings.');saves.push(value);});app.whenReady().then(()=>{const w=new BrowserWindow({width:960,height:820,show:false,webPreferences:{preload:${JSON.stringify(path.join(out,'preload.cjs'))},contextIsolation:true,nodeIntegration:false,sandbox:true}});w.loadFile(${JSON.stringify(path.join(out,'index.html'))});});`);
let app,page;const checks=[],errors=[],evidence={at:new Date().toISOString(),controlledBridge:true,productionAccess:false,providerRequests:0,checks};
async function check(label,task){await task();checks.push(label);}
try{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:require('electron'),args:[path.join(out,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await check('a new goal retains the existing three-turn default and shows concise saved-goal usage',async()=>{
  await expect(page.getByLabel('Goal turn limit',{exact:true})).toHaveValue('3');await expect(page.getByLabel('Keep working until complete',{exact:true})).not.toBeChecked();await expect(page.getByLabel('Use a token budget',{exact:true})).not.toBeChecked();await expect(page.getByText('12 turns · No turn limit',{exact:false})).toBeVisible();
 });
 await check('an explicitly unbounded goal saves its null turn limit and positive token budget',async()=>{
  await page.getByLabel('Goal objective',{exact:true}).fill('Pursue this owned task until complete');await page.getByLabel('Keep working until complete',{exact:true}).check();await expect(page.getByLabel('Goal turn limit',{exact:true})).toHaveCount(0);await page.getByLabel('Use a token budget',{exact:true}).check();await page.getByLabel('Goal token budget',{exact:true}).fill('50000');await page.getByRole('button',{name:'Save goal',exact:true}).click();
  assert.deepEqual(await app.evaluate(()=>saves[0]),{id:undefined,objective:'Pursue this owned task until complete',maxTurns:null,tokenBudget:50000,start:false});
 });
 await check('paused settings restore the saved budget and keep the objective read-only',async()=>{
  await page.evaluate(()=>goalLimitsFixture.reset(true));await expect(page.getByRole('heading',{name:'Goal settings',exact:true})).toBeVisible();await expect(page.getByLabel('Goal objective',{exact:true})).toHaveAttribute('readonly','');await expect(page.getByLabel('Keep working until complete',{exact:true})).toBeChecked();await expect(page.getByLabel('Goal token budget',{exact:true})).toHaveValue('40000');
  await page.getByLabel('Keep working until complete',{exact:true}).uncheck();await page.getByLabel('Goal turn limit',{exact:true}).fill('50');await page.getByLabel('Use a token budget',{exact:true}).uncheck();await page.getByRole('button',{name:'Save and resume',exact:true}).click();const value=await app.evaluate(()=>saves[1]);assert.equal(value.id,saved.id);assert.equal(value.maxTurns,50);assert.equal(value.tokenBudget,null);assert.equal(value.start,true);assert.equal(value.objective,saved.objective);
 });
 await check('a rejected save keeps edited limits and shows the error inside the dialog',async()=>{
  await page.evaluate(()=>goalLimitsFixture.reset(true));await app.evaluate(()=>{failSave=true;});await page.getByLabel('Goal token budget',{exact:true}).fill('60000');await page.getByRole('button',{name:'Save settings',exact:true}).click();await expect(page.getByRole('alert')).toContainText('goal changed');await expect(page.getByLabel('Goal token budget',{exact:true})).toHaveValue('60000');await page.screenshot({path:path.join(out,'goal-settings-dark.png')});
 });
 await check('goal settings fit a narrow light-theme pane without horizontal scrolling',async()=>{
  await page.evaluate(()=>{document.documentElement.dataset.theme='light';});await page.setViewportSize({width:440,height:780});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await expect(page.getByRole('button',{name:'Save settings',exact:true})).toBeVisible();await page.screenshot({path:path.join(out,'goal-settings-narrow.png')});
 });
 assert.deepEqual(errors,[]);evidence.success=true;
}catch(error){evidence.error=error.stack;process.exitCode=1;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});await writeFile(path.join(out,'evidence.json'),JSON.stringify({...evidence,rendererErrors:errors},null,2));console.log(JSON.stringify({success:evidence.success??false,checks:checks.length,out},null,2));}
