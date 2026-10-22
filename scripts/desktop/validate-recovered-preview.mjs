import {parse} from 'acorn';
import {_electron,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'../..'),source=path.join(root,'.supabase/desktop-preview-investigation/recovery-1792375625943/saved-input-27.txt');
const out=path.join(root,'.supabase/desktop-preview-investigation','validation-'+Date.now());
const destination='D:/Users/charl/Documents/ChatGPT/Internal Project - Agentopia/Recovered Slonski Website';
const code=await readFile(source,'utf8'),tree=parse(code,{ecmaVersion:'latest'}),call=tree.body[0].expression;
assert.equal(call.type,'CallExpression');assert.equal(call.callee.name,'store');assert.equal(call.arguments[0].value,'html');
const template=call.arguments[1];assert.equal(template.type,'TemplateLiteral');assert.equal(template.expressions.length,0);assert.equal(template.quasis.length,1);
// Use the parser's literal value only. Never evaluate saved orchestration code.
const html=template.quasis[0].value.cooked;
assert.equal(html.length,33278);assert(html.startsWith('<!doctype html>')&&html.endsWith('</html>'));
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);parse(scripts[0][1],{ecmaVersion:'latest'});
assert(!/\b(?:fetch|XMLHttpRequest|WebSocket|eval|require)\s*\(/.test(scripts[0][1]));
assert(!/<(?:iframe|object|embed)\b|\bon\w+\s*=|<script[^>]+src\s*=/i.test(html));
await mkdir(out);await mkdir(destination,{recursive:true});const file=path.join(destination,'index.html');try{await writeFile(file,html,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;assert.equal(await readFile(file,'utf8'),html);}
const evidence={at:new Date().toISOString(),sourceRequest:'c3bd534e-d54b-4545-b274-ebfcd062a0ad',sourceTurnRecovered:true,savedCodeExecuted:false,sourceCharacters:html.length,sourceBytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex'),file,ordinaryDataModified:false,realProviderRequests:0,checks:[],errors:[],externalRequests:[]};
const check=async(name,work)=>{await work();evidence.checks.push(name);console.log('PASS '+name);};
const require=createRequire(import.meta.url);let app;
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron'),path=require('node:path');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});globalThis.previewDownloads=[];app.whenReady().then(()=>{const w=new BrowserWindow({width:1440,height:1000,show:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});w.webContents.session.on('will-download',(event,item)=>{const file=path.join(${JSON.stringify(out)},path.basename(item.getFilename()));item.setSavePath(file);item.once('done',(event,state)=>globalThis.previewDownloads.push({file,state}));});w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.loadURL('about:blank');});app.on('window-all-closed',()=>app.quit());`);
try{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 app=await _electron.launch({executablePath:require('electron'),args:[path.join(out,'main.cjs')],cwd:root,env});const page=await app.firstWindow();page.setDefaultTimeout(10000);
 page.on('pageerror',error=>evidence.errors.push(error.message));
 await page.route('**/*',route=>{const url=route.request().url();if(/^(?:file|blob|data):/.test(url))return route.continue();evidence.externalRequests.push(url);return route.abort();});
 await page.goto(pathToFileURL(file).href);await page.waitForLoadState('load');
 await check('Recovered file renders locally with its original title and no external requests',async()=>{await expect(page).toHaveTitle(/Slonski Landscaping/);await expect(page.locator('h1')).toBeVisible();assert.deepEqual(evidence.externalRequests,[]);assert.deepEqual(evidence.errors,[]);});
 await check('Every local section link resolves and the desktop layout fits',async()=>{assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href').slice(1)).filter(id=>id&&!document.getElementById(id))),[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true,timeout:10000});});
 await check('An empty project form produces no brief',async()=>{await page.locator('#project-form button[type="submit"]').click();await expect(page.locator('#brief')).toBeHidden();});
 await check('Project details produce a readable downloadable brief without submitting an inquiry',async()=>{
  await page.locator('#name').fill('Recovery verification');await page.locator('#area').fill('Bakersfield garden');await page.locator('#interest').selectOption({label:'Water-wise yard ideas'});await page.locator('#details').fill('Shade and drought-conscious planting.');
  await page.locator('#project-form button[type="submit"]').click();await expect(page.locator('#brief')).toBeVisible();await expect(page.locator('#status')).toContainText('Nothing has been sent');
  await page.locator('#download-brief').click();await expect.poll(()=>app.evaluate(()=>globalThis.previewDownloads.length)).toBe(1);const download=await app.evaluate(()=>globalThis.previewDownloads[0]);assert.equal(download.state,'completed');const text=await readFile(download.file,'utf8');assert(text.includes('Recovery verification')&&text.includes('Shade and drought-conscious planting.')&&text.includes('\nPROJECT BRIEF\n'));assert(!text.includes('\\n'));
 });
 await check('Editing project details clears the outdated brief and download',async()=>{await page.locator('#details').fill('Revised project details.');await expect(page.locator('#brief')).toBeHidden();assert.equal(await page.locator('#download-brief').getAttribute('href'),null);});
 await check('The saved file provides a website source download',async()=>{await page.locator('#source-download').click();await expect.poll(()=>app.evaluate(()=>globalThis.previewDownloads.length)).toBe(2);const download=await app.evaluate(()=>globalThis.previewDownloads[1]);assert.equal(download.state,'completed');assert((await stat(download.file)).size>33000);assert((await readFile(download.file,'utf8')).includes('<title>Slonski Landscaping'));});
 await check('Narrow layout fits and its menu opens and closes with Escape',async()=>{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(390,844));await page.evaluate(()=>scrollTo(0,0));await page.locator('.menu-toggle').click();await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Escape');await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded','false');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true,timeout:10000});});
 assert.deepEqual(evidence.errors,[]);assert.deepEqual(evidence.externalRequests,[]);evidence.success=true;
 await writeFile(path.join(destination,'README.md'),`# Recovered Slonski Landscaping preview\n\nOpen index.html in a browser. This self-contained file works without a preview server and survives closing Agentopia. It was recovered from the original saved Codex turn; no new model request was made.\n\nThe project planner downloads a local brief. It does not send inquiries. Business contact details and advertised services still need confirmation before publication.\n\nOriginal request: ${evidence.sourceRequest}. Recovered HTML SHA-256: ${evidence.sha256}.\n`,{flag:'wx'});
}catch(error){evidence.success=false;evidence.error=error.stack;throw error;}finally{await app?.close();await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:evidence.success,out,file,checks:evidence.checks.length,error:evidence.error}));}
