// Developer inspection of the user's actual installed app. No profile,
// authentication, provider transport, model response or app module substitution.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import WebSocket from 'ws';
import {chromium} from '@playwright/test';
import {hash,closed} from './phased-backup-control.mjs';
const exec=promisify(execFile);
export const waitFor=async(fn,timeout=30000)=>{const until=Date.now()+timeout;while(Date.now()<until){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,300));}throw Error('Observation deadline expired; inspect the saved state before another action.');};
export async function connectInstalledAgent50(intent,{launch=false}={}){
 const out=intent.out,exe='C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-0.44.50\\Agentopia.exe';
 assert.equal(await hash(path.join(path.dirname(exe),'resources/app.asar')),intent.imageSha256);
 await mkdir(path.join(out,'temp'),{recursive:true});
 const explore=target=>exec('explorer.exe',[path.win32.normalize(target)],{windowsHide:true}).catch(error=>{if(error.code!==1||error.stdout||error.stderr)throw error;});
 if(launch){await closed();const command=path.join(out,'Open-Agentopia-Agent-Verification.cmd');await writeFile(command,['@echo off','setlocal','set "ELECTRON_RUN_AS_NODE="','set "NODE_OPTIONS="','set "AGENTOPIA_TEST_PROFILE="','set "TEMP='+path.join(out,'temp')+'"','set "TMP='+path.join(out,'temp')+'"','"'+exe+'" --inspect=0 --remote-debugging-port=0 1>"'+path.join(out,'private-stdout.log')+'" 2>"'+path.join(out,'private-stderr.log')+'"','exit /b %errorlevel%',''].join('\r\n'));await explore(command);}
 const logs=await waitFor(async()=>{try{const value=await readFile(path.join(out,'private-stderr.log'),'utf8');return /Debugger listening on ws:/.test(value)&&/DevTools listening on ws:/.test(value)?value:null;}catch{return null;}},60000);
 const socket=new WebSocket(logs.match(/Debugger listening on (ws:\/\/[^\s]+)/)[1]);await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});let sequence=0;const pending=new Map();
 socket.on('message',bytes=>{const value=JSON.parse(String(bytes)),item=pending.get(value.id);if(item){pending.delete(value.id);clearTimeout(item.timer);value.error?item.reject(Error(value.error.message)):item.resolve(value.result);}});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Installed app inspection timed out: '+method));},45000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 const main=async expression=>{const result=await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result?.value;};
 const browser=await chromium.connectOverCDP(logs.match(/DevTools listening on (ws:\/\/[^\s]+)/)[1]),page=await waitFor(()=>browser.contexts()[0].pages().find(p=>p.url().startsWith('agentopia://app/')));
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 await page.waitForFunction(()=>window.agentopia?.call);await waitFor(async()=>{const state=await call('runtime.status');if(state.phase==='error')throw Error(state.message);return state.ready;},300000);
 const app=await main("(()=>{const {app}=process.mainModule.require('electron');return {version:app.getVersion(),profile:app.getPath('userData'),packaged:app.isPackaged,pid:process.pid};})()");assert.equal(app.version,'0.44.50');assert(app.packaged);assert.equal(path.resolve(app.profile).toLowerCase(),path.resolve('C:/Users/charl/.agentopia/desktop/profile').toLowerCase());
 const auth=await call('auth.state');assert(auth.identity);const providers=await call('providers.status');assert(providers.chatgpt?.authorized);
 const detach=async()=>{socket.close();for(const entry of pending.values())clearTimeout(entry.timer);await browser.close();};
 return {application:app,owner:auth.identity.id,page,call,main,explore,detach};
}
