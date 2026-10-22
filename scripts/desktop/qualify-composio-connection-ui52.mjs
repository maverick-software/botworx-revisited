import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp,rename,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {installComposioFixture} from './composio-application52-workflows.mjs';

desktopOperation('qualify frozen Composio connection UI in the packaged application');
const root=path.resolve(import.meta.dirname,'../..'),json=async f=>JSON.parse(await readFile(f,'utf8'));
const frozen=await json((await json(path.join(root,'.supabase/desktop-composio-connection-ui52/current.json'))).proof),base=await json(frozen.baseProof),cfg=await json((await json(path.join(base.out,'capability10-restore-accepted.json'))).retainedIntent),standard=await json(frozen.standardUserEvidence),primary=await json(path.join(path.dirname(cfg.sourceEvidence),'private-generated-account.json'));
const privateUsers=await json(path.join(path.dirname(frozen.standardUserEvidence),'private-generated-accounts.json')),users=privateUsers.map(row=>({...row,...standard.accounts.find(x=>x.name===row.name)}));
const docsFile=path.join(root,'.supabase/desktop-composio-documents52/1792568372842/evidence.json'),docs=await json(docsFile);assert(docs.success&&docs.checks.length===4&&docs.frozenUi===frozen.ui&&docs.console.length===0);
assert(!(await list(true)).includes(cfg.distribution));assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),base.imageSha256);
const out=path.join(frozen.out,'packaged-'+Date.now());await mkdir(out);const before=path.join(out,'before-ui'),current=path.join(cfg.assets,'ui');
const e={success:false,at:new Date().toISOString(),out,frozenProof:path.join(frozen.out,'proof.json'),documentsEvidence:docsFile,documentsEvidenceSha256:await hash(docsFile),checks:[],productionAccess:false,providerRequests:0,liveComposioRequests:0,backendAndRuntimeUnchanged:true},save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));
const redact=value=>[primary,...users].reduce((s,u)=>s.replaceAll(u.password,'[REDACTED GENERATED PASSWORD]'),String(value));
async function verifyUi(dir){const files=(await readdir(dir,{recursive:true})).filter(n=>!n.endsWith(path.sep));for(const [name,digest]of Object.entries(frozen.uiFiles)){assert.equal(await hash(path.join(dir,name)),digest);}for(const name of files){const file=path.join(dir,name),s=await lstat(file);assert(!s.isSymbolicLink());if(s.isFile())assert(name.replaceAll('\\','/')in frozen.uiFiles);}}
await save();let swapped=false;
try{
 await rename(current,before);swapped=true;await cp(frozen.ui,current,{recursive:true});await verifyUi(current);
 const result=await launchDurableProfileProbe(cfg,{testProfile:false,initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,redact,label:'composio-connection-card-'+Date.now(),runReady:async({application,page})=>{
  const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
  await installComposioFixture(application,root,standard.remoteSnapshot);
  const login=async user=>{await call('auth.signOut');await call('auth.signIn',{email:user.email,password:user.password});await page.reload();await expect(page.getByRole('button',{name:'Plugins and connections',exact:true}).first()).toBeVisible({timeout:30000});};
  try{
   for(const user of users){
    await login(user);assert.equal((await call('auth.state')).identity.id,user.owner);
    await page.getByRole('button',{name:'Plugins and connections',exact:true}).first().click();
    const card=page.getByLabel('Composio connection',{exact:true});await expect(card).toContainText('Project configured');await expect(card).toContainText('1 connected app');await expect(card).toContainText('Configured separately for each user');await card.getByRole('button',{name:'Manage Composio',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Composio',exact:true})).toBeVisible();const status=await call('composio.status');assert.equal(status.connections.length,1);assert.equal(status.connections[0].id,user.connection);
    await page.getByRole('button',{name:'Project settings',exact:true}).click();await expect(page.getByLabel('Composio project API key',{exact:true})).toHaveValue('');await expect(page.getByText('Each user configures their own connection.',{exact:false})).toBeVisible();
    const tools=await call('tools.catalog',{agentId:user.agent});assert(tools.some(x=>x.id==='mcp:'+user.connection&&x.enabled&&x.ready));assert(!tools.some(x=>x.id==='mcp:'+users.find(x=>x.name!==user.name).connection));
    await page.screenshot({path:path.join(out,'standard-'+user.name+'-plugin-connection.png')});e.checks.push('Packaged standard account '+user.name+' opens its private connection from the Plugins card and sees only its assigned tools.');await save();
   }
  }finally{await login(primary);}
  assert.equal((await call('auth.state')).identity.id,standard.originalOwner);assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),0);return {standardAccounts:2,originalAccountRestored:true,providerRequests:0};
 }});
 assert.equal(result.normalExit,0);assert.equal(result.controlledNetwork.calls.length,0);e.probeEvidence=path.join(result.out,'evidence.json');e.checks.push('Actual packaged executable and broker use the frozen connection UI, with no inference requests and normal closure.');
 await verifyUi(current);assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),base.imageSha256);e.success=true;
}catch(error){e.error=redact(error.stack);process.exitCode=1;}
finally{if(swapped){assert(!(await list(true)).includes(cfg.distribution));await rename(current,path.join(out,'qualified-ui'));await rename(before,current);e.qaUiRestored=true;}await save();}
if(e.success)await writeFile(path.join(frozen.out,'qualification.json'),JSON.stringify({success:true,at:new Date().toISOString(),evidence:path.join(out,'evidence.json'),evidenceSha256:await hash(path.join(out,'evidence.json')),proofSha256:await hash(path.join(frozen.out,'proof.json')),packagedStandardAccounts:2,documentRenderChecks:4,backendAndRuntimeUnchanged:true,providerRequests:0,liveComposioRequests:0},null,2),{flag:'wx'});
console.log(JSON.stringify({success:e.success,out,checks:e.checks.length,error:e.error}));
