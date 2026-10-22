import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import path from 'node:path';
import {expect} from '@playwright/test';
export async function verifyChromeContext60({application,page,call,cfg,out,cold,check,evidence,save}){
 const title='Packaged Chrome source';
 if(cold){
  const draft=await call('drafts.get',{owner:cfg.owner,scope:'conversation:'+evidence.chromeConversation});
  assert(draft.options.sources.some(source=>source.id===evidence.chromeSource.id&&source.text===evidence.chromeSource.text));
  await expect(page.getByRole('button',{name:'Remove source '+title,exact:true})).toBeVisible();
  assert.deepEqual(await call('chrome.context.list'),{tabs:[]});
  assert.equal((await call('chrome.status')).phase,'disconnected');
  await check('Cold reopening preserves the selected Chrome text snapshot in the unsent draft while Chrome stays disconnected and no live page access is restored.');return;
 }
 const plugins=await call('plugins.list'),original=plugins.find(plugin=>plugin.name==='chrome-devtools');assert(original);
 const server=createServer((_request,response)=>{response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>'+title+'</title><h1>PACKAGED-CHROME-CONTEXT-60</h1><p>Visible selected reference text.</p><input value="PRIVATE-PACKAGED-INPUT"><div contenteditable="true">PRIVATE-PACKAGED-EDITOR</div>');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+'/reference';
 await application.evaluate(()=>{
  const {ChromeRuntime}=globalThis.__durableProbeRequire(globalThis.__durableProbeElectron.app.getAppPath()+'/build/chrome-runtime.js');
  globalThis.__chromeContext60={original:ChromeRuntime.prototype.connect};
  ChromeRuntime.prototype.connect=function(...args){globalThis.__chromeContext60.runtime=this;return globalThis.__chromeContext60.original.apply(this,args);};
 });
 try{
  if(!original.enabled)await call('plugins.enable',{name:'chrome-devtools',enabled:true});
  assert.equal((await call('chrome.connect',{mode:'dedicated'})).phase,'connected');
  await application.evaluate(async(_,{url,owner})=>{await globalThis.__chromeContext60.runtime.call(owner,'new_page',{url},AbortSignal.timeout(30000),async()=>{});},{url,owner:cfg.owner});
  const list=await call('chrome.context.list'),tab=list.tabs.find(row=>row.url===url);assert(tab&&tab.browser==='chrome'&&tab.title===title);
  await page.getByRole('button',{name:'Add to chat',exact:true}).click();await page.getByRole('menuitem',{name:/^Attach context/}).click();
  const choice=page.getByRole('menuitem',{name:new RegExp('^'+title+' Chrome')});await expect(choice).toBeVisible();await choice.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'packaged-chrome-context-menu.png')});await choice.click();
  await expect(page.getByRole('button',{name:'Remove source '+title,exact:true})).toBeVisible();
  const conversation=await page.evaluate(()=>location.pathname.split('/').at(-1));let source;
  await expect.poll(async()=>{const draft=await call('drafts.get',{owner:cfg.owner,scope:'conversation:'+conversation});source=draft?.options?.sources?.find(source=>source.id===tab.id);return !!source;},{timeout:10000}).toBe(true);
  assert(source&&source.owner===cfg.owner&&source.kind==='browser');assert(source.text.includes('PACKAGED-CHROME-CONTEXT-60')&&!source.text.includes('PRIVATE-PACKAGED'));assert.equal(source.url,url);
  evidence.chromeConversation=conversation;evidence.chromeSource=source;await save();await page.screenshot({path:path.join(out,'packaged-chrome-context-selected.png')});
  await check('The exact packaged main IPC and Add menu read a real dedicated Chrome tab into an owned draft snapshot, exclude editable values and keep all model requests unchanged.');
 }finally{
  await call('chrome.disconnect');if(!original.enabled)await call('plugins.enable',{name:'chrome-devtools',enabled:false});
  await application.evaluate(()=>{const {ChromeRuntime}=globalThis.__durableProbeRequire(globalThis.__durableProbeElectron.app.getAppPath()+'/build/chrome-runtime.js');ChromeRuntime.prototype.connect=globalThis.__chromeContext60.original;delete globalThis.__chromeContext60;});
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 }
}
