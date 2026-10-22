import {_electron,expect} from '@playwright/test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-chat-reading',String(Date.now())),delivered=process.env.AGENTOPIA_READING_UI_RESOURCES;
await mkdir(out,{recursive:true});
if(!delivered)await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {DesktopApp} from './desktop/ui/DesktopApp';import './desktop/ui/style.css';createRoot(document.getElementById('root')).render(<DesktopApp/>);`,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'worklet-url',setup(b){b.onResolve({filter:/\?url$/},args=>({path:path.resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'url'}));b.onLoad({filter:/.*/,namespace:'url'},async args=>({contents:'export default '+JSON.stringify('data:text/javascript,'+encodeURIComponent(await readFile(args.path,'utf8'))),loader:'js'}));}}]});
const fixture=await readFile(path.join(root,'scripts/desktop/workspace-agent-ui-fixture.tsx'),'utf8'),{defaultAgentPolicy}=require(path.join(root,'.supabase/desktop-goal-queue/build/agent-contracts.js'));
const injection=ts.transpileModule('const defaultAgentPolicy='+JSON.stringify(defaultAgentPolicy)+';\n'+fixture.slice(fixture.indexOf('const mira='),fixture.indexOf('function Fixture(){'))+String.raw`
appFixture=true;appDrafts.clear();appOptions.permission='ask';
const replyId='44444444-4444-4444-8444-444444444444',otherId='12345678-1234-4234-8234-123456789abc';
appMessages=[];
for(let i=0;i<26;i++){appMessages.push({id:'prompt-'+i,role:'user',content:{text:'Question '+i+': Help me compare the details.'},metadata:{}});appMessages.push({id:i===25?replyId:'answer-'+i,role:'assistant',sender_agent_id:starter.id,content:{text:'Answer '+i+'. '+('This paragraph gives the saved explanation and its practical consequence. ').repeat(5)},metadata:{status:i===25?'running':'completed',agent:{id:starter.id,name:starter.name,handle:'starter',role:'General helper',revision:1},...(i===25?{timing:{requestId:replyId}}:{})}});}
appMessages[11].metadata.agent={...appMessages[11].metadata.agent,name:'Earlier helper'};
appMessages[21].sender_agent_id=mira.id;appMessages[21].metadata.agent={id:mira.id,name:mira.name,role:'Research specialist',revision:1};
appMessages[31].sender_agent_id=mira.id;appMessages[31].metadata.agent={id:mira.id,name:starter.name,role:'Another agent with the same display name',revision:1};
const otherChat={...appChat,conversation_id:otherId,title:'Another saved chat'},original=window.agentopia.call;
window.agentopia.call=async(action,args={})=>{
 if(action==='preferences.get')return {theme:'dark',textSize:'standard',sendWith:'enter',sidebarCollapsed:false};
 if(action==='conversations.list')return [structuredClone(appChat),structuredClone(otherChat)];
 if(action==='messages.list'){await new Promise(resolve=>setTimeout(resolve,40));return args.conversationId===otherId?[{id:'other-user',role:'user',content:{text:'Another conversation'},metadata:{}},{id:'other-answer',role:'assistant',content:{text:'Another saved result'},metadata:{status:'completed'}}]:structuredClone(appMessages);}
 if(action==='native.active')return [{requestId:replyId,conversationId:chatId}];
 if(action==='chat.queue.list')return [];
 return original(action,args);
};
window.readingStream=()=>{appMessages.at(-1).content.text+=' An additional streamed sentence.';for(const listener of chatListeners)listener({ownerId:appOwner,requestId:replyId,conversationId:chatId,delta:' An additional streamed sentence.'});};
history.replaceState(null,'','/conversations/'+chatId);
`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const server=createServer((req,res)=>{void(async()=>{const name=new URL(req.url,'http://localhost').pathname;const file=delivered?path.resolve(delivered,name.startsWith('/assets/')?name.slice(1):'index.html'):path.join(out,['/app.js','/app.css'].includes(name)?name.slice(1):'index.html');if(delivered)assert(file.startsWith(path.resolve(delivered)+path.sep));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));})().catch(()=>{res.statusCode=404;res.end();});});
if(!delivered)await writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const contentWidth=Number(process.env.AGENTOPIA_READING_UI_WIDTH??1362),contentHeight=Number(process.env.AGENTOPIA_READING_UI_HEIGHT??900);assert(Number.isInteger(contentWidth)&&contentWidth>=800&&contentWidth<=2560&&Number.isInteger(contentHeight)&&contentHeight>=600&&contentHeight<=1600);
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>new BrowserWindow({show:false,width:${contentWidth},height:${contentHeight},useContentSize:true,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}).loadURL('about:blank'));app.on('window-all-closed',()=>app.quit());`);
const evidence={at:new Date().toISOString(),contentWidth,contentHeight,delivered,controlledBridge:true,actualDesktopApp:true,productionAccess:false,inferenceRequests:0,checks:[],failures:[]},env={...process.env};delete env.ELECTRON_RUN_AS_NODE;let app,page;
async function check(name,fn){try{await fn();evidence.checks.push(name);console.log('PASS '+name);}catch(error){evidence.failures.push({name,error:error.message});console.log('FAIL '+name+': '+error.message);}}
try{
 app=await _electron.launch({executablePath:require('electron'),args:[path.join(out,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(5000);await page.addInitScript(injection);await page.goto('http://127.0.0.1:'+server.address().port);await expect(page.locator('article.message')).toHaveCount(52);
 await check('The delivered chat composer omits provider usage footers',async()=>{await expect(page.locator('.composer-caption')).toHaveCount(0);});
 const area=page.getByLabel('Conversation messages',{exact:true}),last=page.locator('article.message').last(),gap=()=>area.evaluate(e=>e.scrollHeight-e.scrollTop-e.clientHeight);
 await check('A restored long chat starts at its latest response',async()=>{await expect.poll(gap).toBeLessThan(3);await expect(last).toBeInViewport();});
 await check('Ordinary replies omit repeated current-agent headings while historical and alternate authors remain visible',async()=>{assert.equal(await page.locator('.message-agent-name').filter({hasText:'Starter'}).count(),4,'Current-agent headings identify a same-name alternate author and each return to the primary author');await expect(page.locator('[data-message-id="answer-5"] .message-agent-name')).toHaveText(/Earlier helper/);await expect(page.locator('[data-message-id="answer-10"] .message-agent-name')).toHaveText(/Mira/);await expect(page.locator('[data-message-id="answer-15"] .message-agent-name')).toHaveAttribute('data-agent-id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');await expect(page.locator('[data-message-id="answer-0"]')).toHaveAttribute('aria-label','Starter response');});
 await check('Timeline navigation keeps the reader in place while another sentence streams',async()=>{await page.getByRole('button',{name:/^Jump to message 1:/}).click();const top=await area.evaluate(e=>e.scrollTop);await page.evaluate(()=>window.readingStream());await page.waitForTimeout(100);assert(Math.abs(await area.evaluate(e=>e.scrollTop)-top)<2);await expect(page.locator('article.message').first()).toBeInViewport();await page.screenshot({path:path.join(out,'earlier-reading.png')});});
 await check('Jump to latest resumes following, including after a chat switch',async()=>{await page.getByRole('button',{name:'Scroll to latest message',exact:true}).click();await expect.poll(gap).toBeLessThan(3);await page.getByRole('button',{name:'Another saved chat',exact:true}).click();await expect(page.getByText('Another saved result',{exact:true})).toBeVisible();await page.getByRole('button',{name:/^Shared fixture conversation/}).click();await expect(page.locator('article.message')).toHaveCount(52);await expect.poll(gap).toBeLessThan(3);await page.evaluate(()=>window.readingStream());await expect.poll(gap).toBeLessThan(3);});
 await page.screenshot({path:path.join(out,'chat-reading-dark.png')});
 evidence.success=evidence.failures.length===0;
}catch(error){evidence.success=false;evidence.error=error.stack;}
finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));if(app)await app.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({success:evidence.success,checks:evidence.checks.length,failures:evidence.failures,out},null,2));if(!evidence.success)process.exitCode=1;
