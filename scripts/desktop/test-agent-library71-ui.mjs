import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {_electron,expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('qualify library organization, archive, replacement and versions in an owned renderer');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-agent-library71','ui-'+Date.now()),require=createRequire(import.meta.url);await mkdir(out,{recursive:true});
const old='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',added='cccccccc-cccc-4ccc-8ccc-cccccccccccc',uncertain='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
let clock=Date.parse('2026-10-23T01:00:00Z'),replacementPicks=0,conflictNext=false,metadataGate=null;
const defaults=row=>({file_extension:path.extname(row.file_name),file_size:100,version:1,updated_at:new Date(clock++).toISOString(),is_archived:false,category:'general',tags:[],description:'',storage_bucket:'agentopia-desktop-database',...row});
const documents=[defaults({id:old,file_name:'Existing reference.md',processing_status:'completed'})];let selected=[old],picks=0;const calls=[],histories=new Map();
async function rpc(action,args){calls.push({action,args});
 if(action==='providers.models')return [{id:'fixture-model',name:'Fixture model'}];
 if(action==='agentSettings.get')return {agent:{personality:'',settings:{}},datastores:[],datastoreIds:[],documents,documentIds:selected,connections:[],connectionIds:[],teams:[],teamIds:[],contacts:[],contactMode:'no_access',contactIds:[],mcp:[],tasks:[]};
 if(action==='agentSettings.documents.pick'){
  assert.equal(args.agentId,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');picks++;
  if(picks===1)return {uploaded:[],errors:[]};
  if(picks===2){documents.push(defaults({id:added,file_name:'Orchard.pdf',processing_status:'completed'}));return {uploaded:[{id:added,name:'Orchard.pdf',truncated:true,notice:'Some pages have no extracted text. Use PDF page reading for scans.'}],errors:['Corrupt.docx: The document could not be read.']};}
  documents.push(defaults({id:uncertain,file_name:'Uncertain.md',processing_status:'completed'}));throw Error('Controlled lost upload acknowledgement');
 }
 if(action==='agentSettings.documents.versions'){const row=documents.find(row=>row.id===args.id);return [{version:row.version,current:true,has_original:true,file_name:row.file_name,file_extension:row.file_extension,file_size:row.file_size,saved_at:row.updated_at},...(histories.get(row.id)||[])];}
 if(['agentSettings.documents.update','agentSettings.documents.replace'].includes(action)){
  const row=documents.find(row=>row.id===args.id);assert(row);
  if(conflictNext&&args.operation==='metadata'){conflictNext=false;row.display_name='Another editor title';row.updated_at=new Date(clock++).toISOString();throw Error('This document changed. Refresh the library.');}
  if(args.expected.version!==row.version||args.expected.updatedAt!==row.updated_at)throw Error('This document changed. Refresh the library.');
  if(args.operation==='metadata'&&metadataGate)await metadataGate;
  if(action==='agentSettings.documents.replace'&&++replacementPicks===1)return {cancelled:true};
  const previous=()=>({version:row.version,current:false,has_original:true,file_name:row.file_name,file_extension:row.file_extension,file_size:row.file_size,saved_at:row.updated_at});
  if(action==='agentSettings.documents.replace'||args.operation==='restore_version'){
   const list=histories.get(row.id)||[],from=args.operation==='restore_version'?list.find(version=>version.version===args.value.version):null;
   histories.set(row.id,[previous(),...list]);row.version++;row.file_name=from?.file_name||'Orchard-replacement.pdf';
  }else if(args.operation==='metadata'){Object.assign(row,{display_name:args.value.name,category:args.value.category,tags:args.value.tags,description:args.value.description});}
  else if(args.operation==='archive'){row.is_archived=true;selected=selected.filter(id=>id!==row.id);}
  else if(args.operation==='restore'){row.is_archived=false;}
  else if(args.operation==='delete_version'){histories.set(row.id,(histories.get(row.id)||[]).filter(version=>version.version!==args.value.version));}
  else if(args.operation==='delete'){assert(row.is_archived);documents.splice(documents.indexOf(row),1);histories.delete(row.id);return {deleted:true};}
  else throw Error('Unexpected library mutation');
  row.updated_at=new Date(clock++).toISOString();return {id:row.id,version:row.version,updated_at:row.updated_at};
 }
 if(action==='agentSettings.save'){assert.equal(args.section,'documents');selected=[...args.value.ids];return;}
 throw Error('Unexpected controlled RPC '+action);
}
await build({entryPoints:[path.join(root,'scripts/desktop/agent-documents70-fixture.tsx')],bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'}});
await writeFile(path.join(out,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer((req,res)=>{void(async()=>{if(req.url==='/rpc'&&req.method==='POST'){let text='';for await(const chunk of req)text+=chunk;const {action,args}=JSON.parse(text);res.setHeader('content-type','application/json');try{res.end(JSON.stringify(await rpc(action,args)??null));}catch(error){res.statusCode=400;res.end(JSON.stringify({error:error.message}));}return;}const relative=['/app.js','/app.css'].includes(req.url)?req.url.slice(1):'index.html';res.setHeader('content-type',relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html');res.end(await readFile(path.join(out,relative)));})().catch(()=>{res.statusCode=500;res.end();});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>new BrowserWindow({show:false,width:1460,height:1000,useContentSize:true,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}).loadURL('about:blank'));app.on('window-all-closed',()=>app.quit());`);
const e={success:false,out,at:new Date().toISOString(),productionAccess:false,providerRequests:0,checks:[],rendererErrors:[],sourceHashes:{}};
for(const file of ['desktop/ui/AgentSettings.tsx','desktop/ui/AgentDocumentsPanel.tsx','desktop/ui/style.css','scripts/desktop/agent-documents70-fixture.tsx'])e.sourceHashes[file]=await hash(path.join(root,file));
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

 await page.setViewportSize({width:1460,height:1000});
 await check('Library details apply immediately while unsaved assignment choices survive refresh.',async()=>{
  await page.getByRole('checkbox',{name:'Uncertain.md',exact:true}).check();await page.getByRole('button',{name:'Manage Orchard.pdf',exact:true}).click();
  const modal=page.getByRole('dialog');await modal.getByLabel('Document name',{exact:true}).fill('Orchard handbook');await modal.getByLabel('Collection',{exact:true}).fill('Operations');await modal.getByLabel('Tags, separated by commas',{exact:true}).fill('budget, receipts');
  await expect(modal.getByRole('button',{name:'Replace file',exact:true})).toBeDisabled();let releaseMetadata;metadataGate=new Promise(resolve=>releaseMetadata=resolve);await modal.getByRole('button',{name:'Save details',exact:true}).click();await expect(modal.getByLabel('Document name',{exact:true})).toBeDisabled();releaseMetadata();metadataGate=null;await expect(modal).toHaveCount(0);
  await expect(page.getByRole('checkbox',{name:'Orchard handbook',exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Uncertain.md',exact:true})).toBeChecked();assert.deepEqual(selected,[added]);
 });
 await check('Search and collection filtering keep hidden assignment choices.',async()=>{
  await page.getByLabel('Collection',{exact:true}).selectOption('Operations');await expect(page.getByRole('checkbox',{name:'Uncertain.md',exact:true})).toHaveCount(0);
  await page.getByLabel('Find documents',{exact:true}).fill('receipts');await expect(page.getByRole('checkbox',{name:'Orchard handbook',exact:true})).toBeChecked();
  await page.getByLabel('Find documents',{exact:true}).fill('missing');await expect(page.getByText('No documents match these filters.',{exact:true})).toBeVisible();
  await page.getByLabel('Collection',{exact:true}).selectOption('');await page.getByLabel('Find documents',{exact:true}).fill('');await expect(page.getByRole('checkbox',{name:'Uncertain.md',exact:true})).toBeChecked();
 });
 await check('Replacement cancellation preserves the dialog, then replacement keeps organization and assignments.',async()=>{
  await page.getByRole('button',{name:'Manage Orchard handbook',exact:true}).click();let modal=page.getByRole('dialog');await modal.getByRole('button',{name:'Replace file',exact:true}).click();await expect(modal.getByRole('button',{name:'Replace file',exact:true})).toBeEnabled();assert.equal(documents.find(row=>row.id===added).version,1);
  await modal.getByRole('button',{name:'Replace file',exact:true}).click();await expect(modal).toHaveCount(0);assert.equal(documents.find(row=>row.id===added).version,2);assert.equal(documents.find(row=>row.id===added).category,'Operations');await expect(page.getByRole('checkbox',{name:'Uncertain.md',exact:true})).toBeChecked();
 });
 await check('A concurrent library change refreshes the list and keeps the unsaved details for review.',async()=>{
  await page.getByRole('button',{name:'Manage Orchard handbook',exact:true}).click();const modal=page.getByRole('dialog');await modal.getByLabel('Document name',{exact:true}).fill('Unsubmitted local details');conflictNext=true;
  await modal.getByRole('button',{name:'Save details',exact:true}).click();await expect(page.getByRole('alert')).toContainText('The library was refreshed');await expect(modal.getByLabel('Document name',{exact:true})).toHaveValue('Unsubmitted local details');
  page.once('dialog',dialog=>dialog.accept());await modal.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('button',{name:'Manage Another editor title',exact:true})).toBeVisible();
 });
 await check('Archive removes saved access; restore grants no assignment and preserves other unsaved choices.',async()=>{
  await page.getByRole('button',{name:'Manage Another editor title',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Archive document',exact:true}).click();assert.deepEqual(selected,[]);
  await page.getByLabel('View',{exact:true}).selectOption('archived');await expect(page.getByRole('checkbox',{name:'Another editor title',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Manage Another editor title',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Restore document',exact:true}).click();
  await page.getByLabel('View',{exact:true}).selectOption('active');await expect(page.getByRole('checkbox',{name:'Another editor title',exact:true})).not.toBeChecked();await expect(page.getByRole('checkbox',{name:'Uncertain.md',exact:true})).toBeChecked();assert.deepEqual(selected,[]);
 });
 await check('Previous file versions can be restored and removed without changing selected assignments.',async()=>{
  await page.getByRole('button',{name:'Manage Another editor title',exact:true}).click();let modal=page.getByRole('dialog');await modal.getByText('File versions',{exact:true}).click();await modal.getByRole('button',{name:'Use version 1',exact:true}).click();await expect(modal).toHaveCount(0);assert.equal(documents.find(row=>row.id===added).version,3);
  await page.getByRole('button',{name:'Manage Another editor title',exact:true}).click();modal=page.getByRole('dialog');await modal.getByText('File versions',{exact:true}).click();page.once('dialog',dialog=>dialog.accept());await modal.getByRole('button',{name:'Delete version 2',exact:true}).click();await expect(modal).toHaveCount(0);assert(!histories.get(added).some(version=>version.version===2));assert.deepEqual(selected,[]);
 });
 await check('Refresh prunes externally archived selections and keeps the remaining draft choices.',async()=>{
  await page.getByRole('checkbox',{name:'Existing reference.md',exact:true}).check();const external=documents.find(row=>row.id===old);external.is_archived=true;external.updated_at=new Date(clock++).toISOString();
  await page.getByRole('button',{name:'Refresh library',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Existing reference.md',exact:true})).toHaveCount(0);await expect(page.getByRole('checkbox',{name:'Uncertain.md',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'Save settings',exact:true}).click();await expect(page.getByText('Saved configuration',{exact:true})).toBeVisible();assert.deepEqual(selected,[uncertain]);
  external.is_archived=false;external.updated_at=new Date(clock++).toISOString();await page.getByRole('button',{name:'Refresh library',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Existing reference.md',exact:true})).not.toBeChecked();
 });
 await check('Permanent removal requires an explicit confirmation and affects only the archived document.',async()=>{
  await page.getByRole('button',{name:'Manage Another editor title',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Archive document',exact:true}).click();await page.getByLabel('View',{exact:true}).selectOption('archived');
  await page.getByRole('button',{name:'Manage Another editor title',exact:true}).click();const modal=page.getByRole('dialog');page.once('dialog',dialog=>dialog.dismiss());await modal.getByRole('button',{name:'Delete permanently',exact:true}).click();assert(documents.some(row=>row.id===added));
  page.once('dialog',dialog=>dialog.accept());await modal.getByRole('button',{name:'Delete permanently',exact:true}).click();await expect(modal).toHaveCount(0);assert(!documents.some(row=>row.id===added));assert(documents.some(row=>row.id===uncertain));await page.getByLabel('View',{exact:true}).selectOption('active');
 });
 await check('Management forms and file actions fit wide/light and narrow/dark dialogs.',async()=>{
  for(const [width,theme]of [[1460,'light'],[520,'dark']]){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.getByRole('button',{name:'Manage Existing reference.md',exact:true}).click();const modal=page.getByRole('dialog');
   assert(await modal.evaluate(element=>element.scrollWidth<=element.clientWidth));await modal.getByRole('button',{name:'Archive document',exact:true}).scrollIntoViewIfNeeded();await expect(modal.getByRole('button',{name:'Archive document',exact:true})).toBeVisible();await page.screenshot({path:path.join(out,'library-manage-'+width+'-'+theme+'.png'),animations:'disabled'});await modal.getByRole('button',{name:'Close dialog',exact:true}).click();}
 });
 assert.deepEqual(e.rendererErrors,[]);for(const [file,digest]of Object.entries(e.sourceHashes))assert.equal(await hash(path.join(root,file)),digest);e.success=true;
}catch(error){e.error=error.stack;process.exitCode=1;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}finally{if(app)await app.close();await new Promise(resolve=>server.close(resolve));await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));}
console.log(JSON.stringify({success:e.success,out,checks:e.checks.length,error:e.error}));
