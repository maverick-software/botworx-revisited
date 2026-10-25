import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('verify local Composio MCP account connections');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-composio161',String(Date.now())),compiled=path.join(out,'build');await mkdir(out,{recursive:true});
const evidence={success:false,at:new Date().toISOString(),out,commands:[],providerRequests:0,liveConsent:false,installed:false};
async function run(name,args,extra={}){let output='';const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,env:{...process.env,...extra}});child.stdout.on('data',b=>{output+=b;process.stdout.write(b);});child.stderr.on('data',b=>{output+=b;process.stderr.write(b);});const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await writeFile(path.join(out,name+'.log'),output);evidence.commands.push({name,code});assert.equal(code,0,name+' failed');}
try{
 await run('backend-types',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',compiled]);await writeFile(path.join(compiled,'package.json'),'{"type":"commonjs"}');
 await run('renderer-types',['node_modules/typescript/bin/tsc','-p','desktop/ui/tsconfig.json']);
 const hook=path.join(out,'isolated-build.cjs');await writeFile(hook,`const Module=require('node:module'),path=require('node:path'),resolve=Module._resolveFilename;Module._resolveFilename=function(request,parent,...args){if(parent?.filename.startsWith(${JSON.stringify(path.join(root,'desktop/tests')+path.sep)})&&request.startsWith('../build/'))request=path.join(${JSON.stringify(compiled)},request.slice('../build/'.length));return resolve.call(this,request,parent,...args);};`);
 await run('protocol-and-permissions',['--require',hook,'--test','--test-timeout=45000','desktop/tests/mcp-oauth.test.cjs','desktop/tests/composio-mcp.test.cjs','desktop/tests/composio-tools.test.cjs','desktop/tests/creation-remote-resources.test.cjs','desktop/tests/remote-plugin-revocation.test.cjs'],{AGENTOPIA_OAUTH_TEST_BUILD:compiled,AGENTOPIA_COMPOSIO_TEST_BUILD:compiled,AGENTOPIA_PREVIEW_BUILD:compiled,AGENTOPIA_PLUGIN_IMPORT_BUILD:compiled});
 await run('rendered-account-flow',['scripts/desktop/test-composio-mcp-ui161.mjs',compiled,path.join(out,'ui')]);await run('retained-api-key-flow',['scripts/desktop/test-composio-ui.mjs',compiled,path.join(out,'legacy-ui')]);evidence.success=true;
}finally{
 evidence.sourceHashes={};for(const name of ['desktop/src/composio-mcp-contracts.ts','desktop/src/mcp-oauth.ts','desktop/src/mcp-oauth-scope.ts','desktop/src/mcp-oauth-connections.ts','desktop/src/plugin-validation.ts','desktop/src/plugins.ts','desktop/src/remote-tools.ts','desktop/src/main.ts','desktop/ui/WorkspaceMode.tsx','desktop/src/broker.ts','desktop/src/creation-remote-resources.ts','desktop/ui/ComposioMcpPanel.tsx','desktop/ui/ComposioPage.tsx','desktop/ui/composio.css','desktop/database/0084-account-composio-preview.sql','desktop/tests/composio-mcp.test.cjs','desktop/tests/fixtures/composio-mcp.cjs','scripts/desktop/test-composio-mcp-ui161.mjs'])evidence.sourceHashes[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await writeFile(path.join(root,'.supabase/desktop-composio161/current.json'),JSON.stringify({out,evidence:path.join(out,'evidence.json')}));console.log('Local Composio evidence: '+path.join(out,'evidence.json'));
}
