import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join('C:/Users/charl/AgentopiaQA/remote-plugin-revocation',String(Date.now()));await mkdir(out,{recursive:true});
const base=JSON.parse(await readFile(path.join(root,'.supabase/desktop-platform-release/candidate-04438/qualification.json'),'utf8'));assert(base.success);
const results=[];async function run(name,args,env={},expected=0){let output='';const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,NODE_PATH:path.join(root,'node_modules'),...env},windowsHide:true});for(const stream of [child.stdout,child.stderr])stream.on('data',v=>output+=v);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});await writeFile(path.join(out,name+'.log'),output);results.push({name,code,pass:Number(output.match(/(?:#|ℹ) pass (\d+)/)?.[1]??0),fail:Number(output.match(/(?:#|ℹ) fail (\d+)/)?.[1]??0)});process.stdout.write(output);assert.equal(code,expected,name);}
let success=false;try{
 await run('baseline38',['--test','--test-reporter=tap','desktop/tests/remote-plugin-revocation.test.cjs'],{AGENTOPIA_PLUGIN_IMPORT_BUILD:path.join(path.dirname(base.evidence),'archived/build')},1);assert.equal(results[0].fail,2);
 await run('compile',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',path.join(out,'build')]);
 await run('corrected',['--test','--test-reporter=tap','desktop/tests/remote-plugin-revocation.test.cjs','desktop/tests/mcp-oauth.test.cjs','desktop/tests/plugin-compatibility.test.cjs'],{AGENTOPIA_PLUGIN_IMPORT_BUILD:path.join(out,'build'),AGENTOPIA_OAUTH_TEST_BUILD:path.join(out,'build')});assert.equal(results[2].pass,35);success=true;
}finally{
 const sources={};for(const file of ['desktop/src/codex-harness.ts','desktop/src/tool-contracts.ts','desktop/src/remote-tools.ts','desktop/tests/remote-plugin-revocation.test.cjs'])sources[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');const evidence={success,at:new Date().toISOString(),phase:'source-qualified-native-remote-plugin-revocation',baseImageSha256:base.imageSha256,results,sources,realProviderRequests:0,installed:false};await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));if(success){const target=path.join(root,'.supabase/desktop-mcp-revocation');await mkdir(target,{recursive:true});await writeFile(path.join(target,'latest.json'),JSON.stringify({path:path.join(out,'evidence.json'),sha256:createHash('sha256').update(await readFile(path.join(out,'evidence.json'))).digest('hex')},null,2));}console.log('Revocation evidence: '+out);
}
