import path from 'node:path';import {readFile,lstat} from 'node:fs/promises';import {createHash} from 'node:crypto';
import manifest from './native-guard-manifest.json';
import type {CodexClient} from './codex-client';
export function nativeToml(value:unknown):string{
 if(Array.isArray(value))return'['+value.map(nativeToml).join(',')+']';
 if(value&&typeof value==='object')return'{'+Object.entries(value).map(([key,value])=>JSON.stringify(key)+'='+nativeToml(value)).join(',')+'}';
 if(typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);throw new Error('Unsupported native configuration value.');
}
export async function nativePatchPolicy(resources:string){
 const file=path.join(resources,'runtime/native-patch-guard.cjs'),info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||createHash('sha256').update(await readFile(file)).digest('hex')!==manifest.sha256)throw new Error('The native Windows patch guard is missing or changed. Reinstall Agentopia before starting native work.');
 // The pinned Windows hook runner uses PowerShell. Preserve exit 2 explicitly:
 // PowerShell otherwise converts a native failure to exit 1, which does not block.
 const encoded=Buffer.from(file,'utf8').toString('base64'),command=`node -e "require(Buffer.from('${encoded}','base64').toString()).run()"; exit $LASTEXITCODE`;
 return {'features.hooks':true,'hooks.PreToolUse':[{matcher:'^apply_patch$',hooks:[{type:'command',command,timeout:10,statusMessage:'Checking Windows rename compatibility'}]}]};
}
export async function trustNativePatchPolicy(client:CodexClient,resources:string,cwd:string){
 const policy=await nativePatchPolicy(resources),expected=policy['hooks.PreToolUse'][0].hooks[0];
 const find=async()=>{const result=await client.request('hooks/list',{cwds:[cwd]}),matches=result.data.flatMap((entry:any)=>entry.hooks).filter((hook:any)=>hook.source==='sessionFlags'&&hook.eventName==='preToolUse'&&hook.handlerType==='command'&&hook.command===expected.command&&hook.matcher==='^apply_patch$'&&hook.statusMessage===expected.statusMessage&&hook.enabled===true&&hook.async===false&&hook.timeoutSec===expected.timeout&&hook.key===hook.sourcePath+':pre_tool_use:0:0');if(matches.length!==1||!/^sha256:[a-f0-9]{64}$/.test(matches[0].currentHash))throw new Error('The built-in native patch check could not be identified. Native work was not started.');return matches[0];};
 let hook=await find();if(hook.trustStatus!=='trusted')await client.request('config/value/write',{keyPath:'hooks.state.'+JSON.stringify(hook.key)+'.trusted_hash',value:hook.currentHash,mergeStrategy:'replace'});
 hook=await find();if(hook.trustStatus!=='trusted')throw new Error('The built-in native patch check is not trusted by this runtime. Native work was not started.');return {key:hook.key,hash:hook.currentHash};
}
