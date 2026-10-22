import {_electron,expect} from '@playwright/test';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';desktopOperation('saved native code tools verification');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-code-tools/live'),file=path.join(out,'evidence.json'),evidence=JSON.parse(await readFile(file,'utf8'));
assert.equal(evidence.runs.length,2,'Two completed provider runs are required; do not substitute replayed inference.');
if(!evidence.success)await copyFile(file,path.join(out,'evidence-before-quoted-path-fix.json'),1).catch(error=>{if(error.code!=='EEXIST')throw error;});
let app,page,owner,location;
const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
try{
 app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[path.join(root,'desktop/build/main.js')],cwd:os.tmpdir(),env:{...process.env,AGENTOPIA_TEST_PROFILE:''},timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(30000);await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:240000});owner=(await call('auth.state')).identity.id;location=await call('navigation.state',{owner});
 await app.evaluate(()=>{const original=globalThis.fetch;globalThis.restoreCodeVerificationFetch=()=>globalThis.fetch=original;globalThis.codeVerificationInference=0;globalThis.fetch=async(input,...args)=>{if(/\/responses(?:\?|$)|chat\/completions/.test(String(input))){globalThis.codeVerificationInference++;throw new Error('Saved verification excludes inference.');}return original(input,...args);};});
 const rows=await call('messages.list',{conversationId:evidence.conversationId});assert.equal(rows.length,4);
 for(const [index,run] of evidence.runs.entries()){
  const response=rows.find(row=>row.role==='assistant'&&row.metadata.timing?.requestId===run.requestId);assert(response);assert.equal(response.metadata.status,'completed');assert.equal(rows.filter(row=>row.role==='user')[index].metadata.options.provider,run.provider);
  const native=response.metadata.native,commands=(index?native.children.flatMap(child=>child.state.items):native.items).filter(entry=>entry.item.type==='commandExecution');
  const proof=commands.find(entry=>entry.completed&&entry.item.exitCode===0&&entry.item.command.includes(index?'inspect-repo.ps1':'initialize-repo.ps1')&&entry.item.aggregatedOutput?.includes(evidence.values[index].marker));assert(proof,'A completed actual native command is required.');
  const output=proof.item.aggregatedOutput;for(const value of ['SHELL_VERSION=7.6.7','GIT_VERSION=git version 2.56.0.windows.2','RG_VERSION=ripgrep 15.2.0'])assert(output.includes(value));const normalized=output.replaceAll('\\','/');assert(normalized.includes('/code-tools/git-2.56.0.windows.2/cmd/git.exe'));assert(normalized.includes('/codex/x86_64-pc-windows-msvc/codex-path/rg.exe'));
  assert(response.content.text.includes(evidence.values[index].marker));
  if(index){assert.equal(native.children.length,1);assert(native.children.every(child=>child.status==='completed'&&child.delivery==='delivered'));assert(!native.reports?.some(report=>report.status==='running'));assert.notEqual(proof.threadId,native.threadId);assert(/^1\t0\t"?notes\//m.test(output));assert(output.includes('CHILD_GIT_DIFF_AND_SEARCH_READY'));assert(response.content.text.includes(evidence.values[0].marker));}
  else assert(output.includes('LOCAL_GIT_AND_SEARCH_READY')&&/BASE_COMMIT=[a-f0-9]{40}/.test(output));
  run.nativeOutput=commands.map(entry=>entry.item.aggregatedOutput);run.savedCommandVerified=true;
 }
 await page.goto('agentopia://app/conversations/'+evidence.conversationId);await expect(page.locator('.message.assistant').last()).toContainText(evidence.values[1].marker);await page.reload();await expect(page.locator('.message.assistant').last()).toContainText(evidence.values[1].marker);assert.deepEqual(await call('messages.list',{conversationId:evidence.conversationId}),rows);await page.screenshot({path:path.join(out,'openrouter-child.png'),animations:'disabled'});
 assert.equal(await app.evaluate(()=>globalThis.codeVerificationInference),0);evidence.historyReopened=true;evidence.savedVerificationWithoutInference=true;evidence.verifierCorrection='Git quotes non-ASCII paths by default; accept its quoted or unquoted numstat path while requiring the actual one-line diff and completed native child output.';delete evidence.error;evidence.success=true;console.log('PASS saved real-provider proof: both packaged native commands, exact binary paths, Git diff and Unicode search, one delivered OpenRouter child, recalled ChatGPT context and unchanged reopened history. No inference repeated.');
}finally{
 if(app){await app.evaluate(()=>globalThis.restoreCodeVerificationFetch?.()).catch(()=>{});if(location)await call('navigation.save',{owner,state:location}).catch(()=>{});await app.close().catch(()=>{});}await writeFile(file,JSON.stringify(evidence,null,2));
}
