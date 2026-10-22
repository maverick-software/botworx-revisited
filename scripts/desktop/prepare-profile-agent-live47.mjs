import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('prepare bounded actual ChatGPT agent verification after profile adoption');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-profile-location'),ledger=path.join(records,'ordinary-agent-live47-current.json');await assert.rejects(readFile(ledger),e=>e.code==='ENOENT');
const accepted=JSON.parse(await readFile(path.join(root,'.supabase/desktop-platform-release/candidate-04447/private-profile-adoption.json'),'utf8'));assert(accepted.success&&accepted.version==='0.44.47'&&accepted.ordinaryExplorerOpeningVerified&&accepted.directDesktopHostOpeningVerified);
const stamp=String(Date.now()),marker='PROFILE47-'+randomBytes(6).toString('hex'),fact='garden lantern '+randomBytes(4).toString('hex'),out=path.resolve('C:/Users/charl/AgentopiaQA/profile-agent-live47',stamp),workspace=path.resolve('D:/Users/charl/AgentopiaQA/profile-agent-live47',stamp);await mkdir(out,{recursive:true});await mkdir(workspace,{recursive:true});
const exec=promisify(execFile),sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const prompt=`${marker}
Perform this bounded verification using the selected ChatGPT connection and your actual Agentopia tools. Work only in the attached verification folder. Do not change agent definitions, settings, existing files, or use websites, plugins, other providers, generic native subagents, or external messages.
1. Using your native Windows command tool, create proof.json in the selected folder containing {"marker":"${marker}","operation":"native-command"}, then read it back.
2. Save exactly one persistent agent memory titled ${marker}, with the fact "${fact}". Link the current user message by passing null source_message_id. This is generated test data.
3. Discover list_agents and use invoke_agent exactly once for another instance of YOUR OWN saved Agentopia identity. Give it only this assignment: "Search your persistent agent memory for title ${marker}. Report the remembered fact and its source citation. Do not write memory or files, inspect other chats, invoke agents, or use other tools." Do not include the remembered fact in this assignment. Wait up to 30 seconds and read its saved result if necessary.
4. If the distinct saved ChatGPT Assistant agent is available and permitted, invoke it exactly once with: "Search only your own agent memory for title ${marker}. Report whether it is available. Do not read chats, files, or other agents, write memory, or invoke agents." Do not include the fact. This checks identity separation.
Read the actual completion results before reporting. Never repeat an uncertain invocation. Stop after these two named invocations. Report the command result, memory source, same-identity recall, and other-identity visibility, with actual status and source links. If a tool is unavailable, state that and stop that check.`;
const intent={format:1,at:new Date().toISOString(),out,workspace,marker,fact,prompt,steering:'For this verification, keep the final report to four short bullet points. Continue the existing checks; do not repeat an agent invocation.',provider:'openai-oauth',model:'gpt-6.1-sol',maxParentSubmissions:1,maxNamedInvocations:2,phase:'prepared-not-sent',productionAgentDefinitionsChanged:false,OpenRouterRequests:0};
await writeFile(path.join(out,'intent.json'),JSON.stringify(intent,null,2),{flag:'wx'});await writeFile(ledger,JSON.stringify({out,intent:path.join(out,'intent.json'),marker,phase:intent.phase},null,2),{flag:'wx'});console.log(JSON.stringify({out,workspace,marker,prompt,steering:intent.steering}));
