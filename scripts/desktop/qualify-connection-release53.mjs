import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {installComposioFixture} from './composio-application52-workflows.mjs';
desktopOperation('qualify actual 53 plugin connection and private storage exclusions');
const root=path.resolve(import.meta.dirname,'../..'),json=async f=>JSON.parse(await readFile(f,'utf8'));
const pp=await json(path.join(root,'.supabase/desktop-connection-release53/current.json')),proof=await json(pp.proof),frozen=await json((await json(path.join(root,'.supabase/desktop-composio-connection-ui52/current.json'))).proof),base=await json(frozen.baseProof),old=await json((await json(path.join(base.out,'capability10-restore-accepted.json'))).retainedIntent),standard=await json(frozen.standardUserEvidence),primary=await json(path.join(path.dirname(old.sourceEvidence),'private-generated-account.json'));
const privateUsers=await json(path.join(path.dirname(frozen.standardUserEvidence),'private-generated-accounts.json')),users=privateUsers.map(row=>({...row,...standard.accounts.find(x=>x.name===row.name)}));
assert(!(await list(true)).includes(old.distribution));assert.equal(await hash(proof.image),proof.imageSha256);
const out=path.join(proof.out,'packaged-'+Date.now());await mkdir(out);const cfg={...old,out,program:proof.program,exe:proof.exe,assets:proof.assets,imageSha256:proof.imageSha256,temp:path.join(out,'temp')};
const e={success:false,at:new Date().toISOString(),out,version:proof.version,imageSha256:proof.imageSha256,checks:[],productionAccess:false,providerRequests:0,liveComposioRequests:0},save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));
const redact=value=>[primary,...users].reduce((s,u)=>s.replaceAll(u.password,'[REDACTED GENERATED PASSWORD]'),String(value));await save();
try{
 const result=await launchDurableProfileProbe(cfg,{testProfile:false,initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,redact,label:'actual53',runReady:async({application,page})=>{
  assert.equal(await application.evaluate(({app})=>app.getVersion()),'0.44.53');
  const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});await installComposioFixture(application,root,standard.remoteSnapshot);
  const login=async user=>{await call('auth.signOut');await call('auth.signIn',{email:user.email,password:user.password});await page.reload();await expect(page.getByRole('button',{name:'Plugins and connections',exact:true}).first()).toBeVisible({timeout:30000});};
  try{for(const user of users){
   await login(user);assert.equal((await call('auth.state')).identity.id,user.owner);
   const before=await call('files.list');
   for(const directory of ['F:\\Agentopia-Data\\runtime\\a91a4800-e08f-4440-a4ec-588762d01bfd','F:\\Agentopia-Data\\runtime\\legacy-AgentopiaRuntime']){
    await application.evaluate(({dialog},directory)=>{globalThis.__originalPicker=dialog.showOpenDialog;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},directory);
    try{await assert.rejects(call('files.pick',{kind:'folder'}),/application and credential storage|backend|cannot be attached/i);}finally{await application.evaluate(({dialog})=>{dialog.showOpenDialog=globalThis.__originalPicker;delete globalThis.__originalPicker;});}
   }
   assert.deepEqual(await call('files.list'),before);e.checks.push('Actual 53 main excludes both registered F-drive private runtime folders from account '+user.name+' attachments, with no file reads or added references.');
   await page.getByRole('button',{name:'Plugins and connections',exact:true}).first().click();const card=page.getByLabel('Composio connection',{exact:true});await expect(card).toContainText('Project configured');await expect(card).toContainText('1 connected app');await expect(card).toContainText('Configured separately for each user');await card.getByRole('button',{name:'Manage Composio',exact:true}).click();await expect(page.getByRole('heading',{name:'Composio',exact:true})).toBeVisible();
   const status=await call('composio.status');assert.equal(status.connections.length,1);assert.equal(status.connections[0].id,user.connection);await page.getByRole('button',{name:'Project settings',exact:true}).click();await expect(page.getByLabel('Composio project API key',{exact:true})).toHaveValue('');
   const tools=await call('tools.catalog',{agentId:user.agent});assert(tools.some(x=>x.id==='mcp:'+user.connection&&x.enabled&&x.ready));assert(!tools.some(x=>x.id==='mcp:'+users.find(x=>x.name!==user.name).connection));await page.screenshot({path:path.join(out,'standard-'+user.name+'-connection53.png')});e.checks.push('Actual 53 Plugins card opens the private Composio connection and assigned agent tools for standard account '+user.name+'.');await save();
  }}finally{await login(primary);}
  assert.equal((await call('auth.state')).identity.id,standard.originalOwner);assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),0);return {version:'0.44.53',standardAccounts:2,originalAccountRestored:true,providerRequests:0};
 }});
 assert.equal(result.normalExit,0);assert.equal(result.controlledNetwork.calls.length,0);e.probeEvidence=path.join(result.out,'evidence.json');e.checks.push('Exact 53 executable and archived main start the retained generated-account database and close normally without inference or real Composio calls.');assert.equal(await hash(proof.image),proof.imageSha256);e.success=true;
}catch(error){e.error=redact(error.stack);e.cause=redact(error.cause?.stack??'');process.exitCode=1;}await save();await writeFile(path.join(proof.out,'packaged-qualification.json'),JSON.stringify({success:e.success,evidence:path.join(out,'evidence.json'),imageSha256:proof.imageSha256,proofSha256:await hash(pp.proof)},null,2));console.log(JSON.stringify({success:e.success,out,checks:e.checks.length,error:e.error,cause:e.cause}));
