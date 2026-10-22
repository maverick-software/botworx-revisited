import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('verify encrypted Composio persistence and portable recovery');
const root=path.resolve(import.meta.dirname,'../..'),build=path.resolve(process.argv[2]??''),out=path.resolve(process.argv[3]??'');for(const directory of [build,out])assert(directory.startsWith(path.join(root,'.supabase/desktop-composio')+path.sep));await mkdir(out,{recursive:true});
const main=String.raw`
const {app,safeStorage}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const build=process.env.AGENTOPIA_COMPOSIO_TEST_BUILD,out=process.env.AGENTOPIA_COMPOSIO_ENCRYPTION_OUT,root=process.env.AGENTOPIA_COMPOSIO_ROOT;
app.setPath('userData',path.join(out,'electron-profile'));
const {Secrets}=require(path.join(build,'secrets.js')),{ComposioConnections}=require(path.join(build,'composio-connections.js')),{capturePortableSettings,readPortableSettings,applyPortableSettings}=require(path.join(build,'portable-settings.js')),{fixture,key}=require(path.join(root,'desktop/tests/fixtures/composio.cjs'));
app.whenReady().then(async()=>{
 const evidence={success:false,checks:[],actualWindowsEncryption:true,liveComposioRequests:0,providerRequests:0,productionProfileChanged:false};
 const check=name=>{evidence.checks.push(name);console.log('PASS '+name);};
 try{
  assert.equal(process.platform,'win32');assert(safeStorage.isEncryptionAvailable());const f=fixture(),directory=path.join(out,'source'),targetDirectory=path.join(out,'restored'),store=new Secrets(directory);await store.load();
  const service=store=>new ComposioConnections(store,async()=>f.owner,async(owner,agent)=>{assert.equal(owner,f.owner);assert.equal(agent,f.agent);},async url=>{assert(url.startsWith('https://connect.composio.dev/'));},()=>f.client);
  const source=service(store);await source.configure(f.owner,key);const connection=await source.connect(f.owner,{toolkit:'github',scheme:'OAUTH2',name:'Encrypted work GitHub'});f.accounts.get(connection.accountId).status='ACTIVE';await source.refresh(f.owner,connection.id);await source.assign(f.owner,connection.id,[f.agent]);const user=(await source.authorized(f.owner,f.agent,connection.id)).user;
  const bytes=await fs.readFile(path.join(directory,'credentials.bin'));assert(!bytes.includes(Buffer.from(key)));assert(!bytes.includes(Buffer.from(connection.accountId)));check('Actual Windows encryption hides the generated key and connection metadata on disk');
  const reopened=new Secrets(directory);await reopened.load();assert.equal(reopened.get('composio-key:'+f.owner),key);const authority=await service(reopened).authorized(f.owner,f.agent,connection.id);assert.equal(authority.user,user);assert.deepEqual(authority.connection.agents,[f.agent]);check('A new credentials controller reloads the key, same remote user and restricted agent grant');
  const record=capturePortableSettings([f.owner],'a'.repeat(64),owner=>readPortableSettings(reopened,owner));assert(!JSON.stringify(record).includes(key));const target=new Secrets(targetDirectory);await target.load();await applyPortableSettings(target,record,f.owner,async()=>{});check('Portable export excludes the key and restores disabled bindings through the actual encrypted store');
  const cold=new Secrets(targetDirectory);await cold.load();assert.equal(cold.get('composio-key:'+f.owner),undefined);const restored=service(cold);assert(!(await restored.status(f.owner)).configured);await assert.rejects(restored.authorized(f.owner,f.agent,connection.id),/Connect a Composio project/);await restored.configure(f.owner,key);await assert.rejects(restored.authorized(f.owner,f.agent,connection.id),/disabled/);await restored.refresh(f.owner,connection.id);assert.equal((await restored.authorized(f.owner,f.agent,connection.id)).user,user);check('Cold restore cannot use tools until project credentials and the exact remote account are verified');
  await restored.disconnect(f.owner,connection.id);await applyPortableSettings(cold,record,f.owner,async()=>{});assert.equal((await restored.status(f.owner)).connections[0].status,'DISCONNECTED');check('Repeated recovery preserves a later user disconnection');
  const brokenDirectory=path.join(out,'publication-failure');await fs.mkdir(path.join(brokenDirectory,'credentials.bin'),{recursive:true});const broken=new Secrets(brokenDirectory);await assert.rejects(applyPortableSettings(broken,record,f.owner,async()=>{}));assert.equal(broken.get('composio-state:'+f.owner),undefined);assert.equal(broken.get('portable-settings-recovery:'+f.owner),undefined);check('Failed encrypted-file publication leaves connection data and the recovery receipt unpublished');
  evidence.success=true;
 }catch(error){evidence.error=String(error.message).replaceAll(key,'[generated key]');process.exitCode=1;}
 await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));app.exit(evidence.success?0:1);
});`;
await writeFile(path.join(out,'main.cjs'),main);const env={...process.env,AGENTOPIA_COMPOSIO_TEST_BUILD:build,AGENTOPIA_COMPOSIO_ENCRYPTION_OUT:out,AGENTOPIA_COMPOSIO_ROOT:root};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(path.join(root,'node_modules/electron/dist/electron.exe'),[path.join(out,'main.cjs')],{cwd:root,env,windowsHide:true});let log='';for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{log+=bytes;process.stdout.write(bytes);});const timer=setTimeout(()=>child.kill(),60000),code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);}).finally(()=>clearTimeout(timer));await writeFile(path.join(out,'electron.log'),log);assert.equal(code,0,'Encrypted Composio qualification failed; inspect '+out);const evidence=JSON.parse(await readFile(path.join(out,'evidence.json'),'utf8'));assert(evidence.success&&evidence.checks.length===6);console.log('Encrypted Composio evidence: '+path.join(out,'evidence.json'));
