import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),base=path.join(root,'.supabase/desktop-native-search'),ledger=path.join(base,'ordinary-exa-live.json');
await readFile(ledger).then(()=>{throw Error('An ordinary Exa test is already recorded. Inspect its saved request before proceeding.');},error=>{if(error.code!=='ENOENT')throw error;});
const out=path.join(base,'ordinary-'+Date.now()),marker='EXA-AGENT-'+randomBytes(6).toString('hex');await mkdir(out);
const prompt=marker+'\nUse the selected Exa MCP connection to perform exactly one web search for official OpenAI documentation about standalone web search with a custom Codex model provider. Discover its current input schema first, including required arguments. Use at most three results. Wait for the tool result before answering, then state whether selecting a custom provider alone enables standalone search and cite one official documentation URL. Do not use shell commands, local files, other search services, browser tools, or subagents. Do not repeat an interrupted or uncertain search.';
const intent={at:new Date().toISOString(),marker,prompt,provider:'openai-oauth',model:'gpt-6.1-sol',purpose:'One ordinary installed ChatGPT/Codex turn exercising the reviewed keyless plugin through its actual chat interface',phase:'prepared-not-sent',out,OpenRouterRequests:0};await writeFile(path.join(out,'intent.json'),JSON.stringify(intent,null,2),{flag:'wx'});await writeFile(ledger,JSON.stringify(intent,null,2),{flag:'wx',flush:true});console.log(JSON.stringify({out,marker,prompt}));
