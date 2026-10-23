import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {_electron,expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('qualify persistent document editor in an owned controlled renderer');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-agent-documents70','ui-'+Date.now()),require=createRequire(import.meta.url);await mkdir(out,{recursive:true});
const old='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',added='cccccccc-cccc-4ccc-8ccc-cccccccccccc',uncertain='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const documents=[{id:old,file_name:'Existing reference.md',processing_status:'completed'}];let selected=[old],picks=0;const calls=[];
async function rpc(action,args){calls.push({action,args});
 if(action==='providers.models')return [{id:'fixture-model',name:'Fixture model'}];
 if(action==='agentSettings.get')return {agent:{personality:'',settings:{}},datastores:[],datastoreIds:[],documents,documentIds:selected,connections:[],connectionIds:[],teams:[],teamIds:[],contacts:[],contactMode:'no_access',contactIds:[],mcp:[],tasks:[]};
 if(action==='agentSettings.documents.pick'){
  assert.equal(args.agentId,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');picks++;
  if(picks===1)return {uploaded:[],errors:[]};
  if(picks===2){documents.push({id:added,file_name:'Orchard.pdf',processing_status:'completed'});return {uploaded:[{id:added,name:'Orchard.pdf',truncated:true,notice:'Some pages have no extracted text. Use PDF page reading for scans.'}],errors:['Corrupt.docx: The document could not be read.']};}
  documents.push({id:uncertain,file_name:'Uncertain.md',processing_status:'completed'});throw Error('Controlled lost upload acknowledgement');
 }
 if(action==='agentSettings.save'){assert.equal(args.section,'documents');selected=[...args.value.ids];return;}
 throw Error('Unexpected controlled RPC '+action);
}
await build({entryPoints:[path.join(root,'scripts/desktop/agent-documents70-fixture.tsx')],bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'}});
await writeFile(path.join(out,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer((req,res)=>{void(async()=>{if(req.url==='/rpc'&&req.method==='POST'){let text='';for await(const chunk of req)text+=chunk;const {action,args}=JSON.parse(text);res.setHeader('content-type','application/json');try{res.end(JSON.stringify(await rpc(action,args)??null));}catch(error){res.statusCode=400;res.end(JSON.stringify({error:error.message}));}return;}const relative=['/app.js','/app.css'].includes(req.url)?req.url.slice(1):'index.html';res.setHeader('content-type',relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html');res.end(await readFile(path.join(out,relative)));})().catch(()=>{res.statusCode=500;res.end();});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>new BrowserWindow({show:false,width:1460,height:1000,useContentSize:true,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}).loadURL('about:blank'));app.on('window-all-closed',()=>app.quit());`);
const e={success:false,out,at:new Date().toISOString(),productionAccess:false,providerRequests:0,checks:[],rendererErrors:[],sourceHashes:{}};
for(const file of ['desktop/ui/AgentSettings.tsx','desktop/ui/AgentDocumentsPanel.tsx','scripts/desktop/agent-documents70-fixture.tsx'])e.sourceHashes[file]=await hash(path.join(root,file));
const env={...process.env,TEMP:path.join(out,'temp'),TMP:path.join(out,'temp')};await mkdir(env.TEMP);delete env.ELECTRON_RUN_AS_NODE;let app,page;
const check=async(name,work)=>{await work();e.checks.push(name);console.log('PASS '+name);};
try{
 app=await _electron.launch({executablePath:require('electron'),args:[path.join(out,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(8000);page.on('pageerror',error=>e.rendererErrors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
 await check('Existing saved selections load without the old upload placeholder.',async()=>{await expect(page.getByRole('checkbox',{name:'Existing reference.md'})).toBeChecked();await expect(page.getByText('Saved configuration',{exact:true})).toBeVisible();await expect(page.getByText(/require further desktop integration/)).toHaveCount(0);});
 await check('Cancelling the file picker leaves selections and unsaved state unchanged.',async()=>{await page.getByRole('button',{name:'Add documents',exact:true}).click();await expect(page.getByRole('button',{name:'Add documents',exact:true})).toBeEnabled();await expect(page.getByText('Saved configuration',{exact:true})).toBeVisible();assert.equal(picks,1);});
 await check('Upload refresh preserves unsaved removals, selects new files, and reports partial failures and incomplete extraction.',async()=>{await page.getByRole('checkbox',{name:'Existing reference.md'}).uncheck();await page.getByRole('button',{name:'Add documents',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Orchard.pdf'})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Existing reference.md'})).not.toBeChecked();await expect(page.locator('.settings-content').getByRole('status')).toContainText('Corrupt.docx');await expect(page.locator('.settings-content').getByRole('status')).toContainText('Some pages');assert.equal(calls.filter(call=>call.action==='agentSettings.save').length,0);});
 await check('Save commits exactly the displayed assignments; reopening reloads them.',async()=>{await page.getByRole('button',{name:'Save settings',exact:true}).click();await expect(page.getByText('Saved configuration',{exact:true})).toBeVisible();assert.deepEqual(selected,[added]);await page.getByRole('button',{name:'Close agent editor',exact:true}).click();await page.getByRole('button',{name:'Reopen editor'}).click();await expect(page.getByRole('checkbox',{name:'Orchard.pdf'})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Existing reference.md'})).not.toBeChecked();});
 await check('An uncertain upload refreshes the library without retrying or silently assigning its result.',async()=>{await page.getByRole('button',{name:'Add documents',exact:true}).click();await expect(page.getByRole('alert')).toContainText('check it before adding');await expect(page.getByRole('checkbox',{name:'Uncertain.md'})).not.toBeChecked();assert.equal(picks,3);assert.deepEqual(selected,[added]);});
 await check('Document controls stay inside wide and narrow layouts in both themes.',async()=>{for(const [width,theme]of [[1460,'light'],[520,'dark']]){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await expect(page.getByRole('button',{name:'Add documents',exact:true})).toBeVisible();assert(await page.getByRole('region',{name:'Edit agent',exact:true}).evaluate(element=>element.scrollWidth<=element.clientWidth));await page.screenshot({path:path.join(out,'documents-'+width+'-'+theme+'.png'),animations:'disabled'});}});
 assert.deepEqual(e.rendererErrors,[]);for(const [file,digest]of Object.entries(e.sourceHashes))assert.equal(await hash(path.join(root,file)),digest);e.success=true;
}catch(error){e.error=error.stack;process.exitCode=1;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}finally{if(app)await app.close();await new Promise(resolve=>server.close(resolve));await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));}
console.log(JSON.stringify({success:e.success,out,checks:e.checks.length,error:e.error}));
