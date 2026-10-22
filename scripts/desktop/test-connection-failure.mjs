import {transform} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'../..'),file=path.join(root,'desktop/ui/connection-failure.ts'),source=await readFile(file),sha=b=>createHash('sha256').update(b).digest('hex');
const compiled=await transform(source.toString(),{loader:'ts',format:'esm'}),{connectionFailure,failureProvider}=await import('data:text/javascript,'+encodeURIComponent(compiled.code));
const prior='C:/Users/charl/AgentopiaQA/provider-refusals/1792393494060',receipt=JSON.parse(await readFile(path.join(prior,'acceptance.json'),'utf8')),bytes=await readFile(receipt.evidence);assert.equal(sha(bytes),receipt.evidenceSha256);const native=JSON.parse(bytes),checks=[];
const titles={'chatgpt-quota':'ChatGPT usage limit reached','chatgpt-expired-credential':'Reconnect ChatGPT','chatgpt-denied-model':'ChatGPT model access unavailable','chatgpt-disconnected':'ChatGPT connection unavailable','explicit-openrouter-out-of-credit':'OpenRouter credits needed'};
for(const row of native.cases.filter(row=>row.terminal==='failed')){const result=connectionFailure(row.error,row.provider);assert.equal(result?.title,titles[row.name]);assert(!JSON.stringify(result).includes('127.0.0.1'));checks.push(row.name+' maps its actual native failure to readable provider-specific guidance');}
const officeOut='C:/Users/charl/AgentopiaQA/office-edit-live/1792463902974',officePointer=JSON.parse(await readFile(path.join(officeOut,'latest-capture.json'),'utf8')),officePath=path.join(officeOut,path.basename(officePointer.file)),officeBytes=await readFile(officePath),office=JSON.parse(officeBytes);
assert(office.readOnly&&office.parents.length===1&&office.parents[0].status==='failed'&&office.tools.length===0);
const subscriptionError=office.parents[0].error,plainSubscriptionError=subscriptionError.replace(/^stream disconnected before completion: /,'');
for(const error of [subscriptionError,plainSubscriptionError]){const result=connectionFailure(error,'openai-oauth');assert.equal(result?.title,'ChatGPT usage limit reached');assert.match(result.message,/account menu/);assert(!/reconnect|API key/.test(result.message));checks.push('Observed subscription-limit refusal has readable usage guidance');}
for(const [error,provider]of [[subscriptionError,'openrouter'],[subscriptionError,undefined],['A document quoted '+subscriptionError,'openai-oauth'],['Workspace tool failed: '+plainSubscriptionError,'openai-oauth']]){assert.equal(connectionFailure(error,provider),null);checks.push('Subscription-limit recognition remains restricted to its recorded provider and exact native error');}
for(const [name,error,provider]of [
 ['tool permissions','Workspace tool returned HTTP 403: permission denied','openai-oauth'],
 ['file status','File status: 401','openai-oauth'],
 ['native routing','This native request does not belong to an active owned turn.','openai-oauth'],
 ['unknown provider','unexpected status 401 Unauthorized',undefined],
 ['successful response',undefined,'openai-oauth'],
 ['other native failure','unexpected status 500 Internal Server Error','openai-oauth'],
 ['ChatGPT payment refusal','unexpected status 402 Payment Required','openai-oauth'],
 ['agent quoted status','The report says unexpected status 403 Forbidden','openai-oauth']
]){assert.equal(connectionFailure(error,provider),null);checks.push(name+' retains the original failure instead of inventing a connection diagnosis');}
const message=(role,provider)=>({role,metadata:provider?{options:{provider}}:{}});
for(const [name,current,previous,expected]of [
 ['saved SQL assistant without options',message('assistant'),message('user','openai-oauth'),'openai-oauth'],
 ['saved OpenRouter prompt',message('assistant'),message('user','openrouter'),'openrouter'],
 ['optimistic explicit assistant options',message('assistant','openai-oauth'),message('user','openrouter'),'openai-oauth'],
 ['unrelated earlier assistant',message('assistant'),message('assistant','openrouter'),undefined],
 ['historical prompt without saved provider',message('assistant'),message('user'),undefined],
 ['missing prompt',message('assistant'),undefined,undefined],
 ['user message',message('user','openrouter'),message('user','openai-oauth'),undefined]
]){assert.equal(failureProvider(current,previous),expected);checks.push(name+' resolves only its own recorded connection');}
const out=path.join('C:/Users/charl/AgentopiaQA/provider-failure-classification',String(Date.now()));await mkdir(out,{recursive:true});await writeFile(path.join(out,'evidence.json'),JSON.stringify({success:true,at:new Date().toISOString(),sourceSha256:sha(source),nativeEvidenceSha256:receipt.evidenceSha256,subscriptionErrorEvidence:{file:officePath,sha256:sha(officeBytes),requestId:office.parents[0].id},checks,realProviderRequests:0,productInstalled:false},null,2));console.log(JSON.stringify({success:true,out,checks:checks.length}));
