import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),id=process.argv[2];assert(/^\d{13}$/.test(id));
const out=path.join(root,'.supabase/desktop-workspace-agents/local-session-transfer',id),runtime=JSON.parse(await readFile(path.join(out,'private-runtime.json'),'utf8'));
const prompt='Reply with exactly OAUTH-ORDINARY-1792308191573. Do not use tools or inspect files.';
const expected='OAUTH-ORDINARY-1792308191573';assert(new URL(runtime.api).hostname==='127.0.0.1');
async function get(table,query){const response=await fetch(runtime.api+'/rest/v1/'+table+'?'+new URLSearchParams(query),{headers:{apikey:runtime.service,Authorization:'Bearer '+runtime.service},signal:AbortSignal.timeout(15000)});assert(response.ok,'Local read-only request failed');return response.json();}
const messages=await get('chat_messages_v2',{select:'id,metadata',role:'eq.user','content->>text':'eq.'+prompt});assert.equal(messages.length,1,'Expected one submitted verification message');
const requests=await get('desktop_requests',{select:'id,status,error,conversation_id,assistant_message_id,created_at,updated_at',user_message_id:'eq.'+messages[0].id});assert.equal(requests.length,1);const request=requests[0];assert.equal(request.status,'completed');assert.equal(request.error,null);
const replies=await get('chat_messages_v2',{select:'id,role,content,metadata',id:'eq.'+request.assistant_message_id});assert.equal(replies.length,1);assert.equal(replies[0].role,'assistant');assert.equal(replies[0].content.text,expected);
const native=await get('desktop_codex_turns',{select:'*',request_id:'eq.'+request.id});assert.equal(native.length,1);
const result={success:true,at:new Date().toISOString(),installedVersion:'0.43.7',prompt,request,reply:replies[0].content.text,assistantMetadata:replies[0].metadata,native:{requestId:native[0].request_id,threadId:native[0].thread_id,turnId:native[0].turn_id,runtimeVersion:native[0].runtime_version,provider:native[0].context.provider,options:native[0].context.options,items:native[0].state.items.map(item=>({type:item.item.type,completed:item.completed}))},submittedMessages:1,submittedRequests:1,simulated:false};
assert.equal(native[0].provider??native[0].context?.options?.provider,'openai-oauth','The saved native turn must prove ChatGPT selection');
assert.equal(result.native.options.harness,'codex');assert(result.native.items.some(item=>item.type==='agentMessage'&&item.completed));assert(result.native.items.every(item=>['userMessage','agentMessage','reasoning'].includes(item.type)),'Unexpected tool execution in the minimal check');
await writeFile(path.join(out,'live-evidence-verified.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result,null,2));
