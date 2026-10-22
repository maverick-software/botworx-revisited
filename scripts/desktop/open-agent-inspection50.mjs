import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {connectInstalledAgent50} from './connect-agent-live50.mjs';
desktopOperation('open actual installed agent50 inspection without inference');
const root=path.resolve(import.meta.dirname,'../..'),pointer=JSON.parse(await readFile(path.join(root,'.supabase/desktop-agent-live50/current.json'),'utf8')),intent=JSON.parse(await readFile(pointer.intent,'utf8'));
assert(intent.phase==='prepared-not-sent');
const app=await connectInstalledAgent50(intent,{launch:true});
try{
 const navigation=await app.call('navigation.state',{owner:app.owner}),agents=await app.call('agents.list');
 assert(agents.length===intent.originalAgents.length&&intent.originalAgents.every(id=>agents.some(a=>a.id===id)));
 const original={at:new Date().toISOString(),owner:app.owner,application:app.application,navigation,url:app.page.url(),agents,providers:await app.call('providers.status'),pane:await app.call('workspace.state',{scope:navigation.conversationId,owner:app.owner}),draft:await app.page.getByRole('textbox',{name:'Message',exact:true}).inputValue(),modelTitle:await app.page.getByRole('button',{name:'Model and thinking',exact:true}).getAttribute('title')};
 await writeFile(path.join(intent.out,'private-original.json'),JSON.stringify(original,null,2),{flag:'wx'});
 await app.page.screenshot({path:path.join(intent.out,'original-before-agent-verification.png')});
 console.log(JSON.stringify({success:true,out:intent.out,version:app.application.version,actualProfile:true,savedAgents:agents.length,providerRequests:0,originalStateRecorded:true}));
}finally{await app.detach();}
