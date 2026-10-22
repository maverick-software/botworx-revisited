import {_electron,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';desktopOperation('installed native Windows helper verification');
const root=path.resolve(import.meta.dirname,'../..'),exe=process.env.AGENTOPIA_LIVE_EXE;assert(exe,'Set AGENTOPIA_LIVE_EXE to the installed application.');
const out=path.join(root,'.supabase/desktop-computer-release/installed-helper');await mkdir(out,{recursive:true});const evidence={at:new Date().toISOString(),inference:false,input:false,minimalPath:true};let app,page,fixture,grant;
const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
try{
 fixture=spawn(path.join(root,'.supabase/desktop-computer-poc/fixture/Agentopia.Computer.Fixture.exe'),[path.join(out,'receipt.json'),'INSTALLED-HELPER-READ-ONLY'],{windowsHide:false,stdio:'ignore'});
 app=await _electron.launch({executablePath:exe,args:[],cwd:os.tmpdir(),env:{...process.env,AGENTOPIA_TEST_PROFILE:'',PATH:[process.env.SYSTEMROOT+'\\System32',process.env.SYSTEMROOT,process.env.SYSTEMROOT+'\\System32\\Wbem'].join(';')},timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(30000);await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:240000});evidence.version=await app.evaluate(({app})=>app.getVersion());assert.equal(evidence.version,'0.32.0');
 let target;await expect.poll(async()=>{const rows=await call('computer.choices',{existing:[]});target=rows.find(row=>row.title==='Agentopia Computer Verification'&&row.available);return !!target;}).toBe(true);
 [grant]=await call('computer.select',{ids:[target.id],existing:[]});assert(grant?.available);const refs=await call('computer.references',{ids:[grant.id]});assert.equal(refs.length,1);assert(refs[0].available);const status=await call('computer.status');assert(status.available&&status.selected===1);evidence.emergencyShortcut=status.shortcut;
 await call('computer.revoke',{id:grant.id});assert.equal((await call('computer.status')).selected,0);assert.equal((await call('computer.references',{ids:[grant.id]}))[0].available,false);grant=null;evidence.nativeHelperWithoutSdkOrNodeOnPath=true;evidence.selectionAndRevocation=true;evidence.success=true;console.log('PASS installed native Windows helper: actual window enumeration, account-bound selection, reference validation and revocation from a temporary working directory with Node and .NET SDK absent from PATH. No inference or input.');
}catch(error){evidence.error=error.message;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{if(app){if(grant)await call('computer.revoke',{id:grant.id}).catch(()=>{});await app.close().catch(()=>{});}if(fixture&&!fixture.killed)fixture.kill();await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));}

