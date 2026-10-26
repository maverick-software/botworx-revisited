// Start the actual candidate program with an empty isolated profile and no runtime.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {computerDesign83Base,computerDesign83Records,verifyComputerDesign83Proof} from './prepare-computer-design83.mjs';

desktopOperation('qualify actual Computer design83 packaged renderer without production access');
const pointer=await json(path.join(computerDesign83Records,'current.json')),p=await json(pointer.proof),base=await json(computerDesign83Base),q=await json(path.join(p.out,'qualification.json'));verifyComputerDesign83Proof(p,base);assert.equal(await hash(pointer.proof),q.proofSha256);
for(const[name,digest]of Object.entries(p.programFiles))assert.equal(await hash(path.join(p.program,name)),digest,name);for(const[name,digest]of Object.entries(p.resourceFiles))assert.equal(await hash(path.join(p.assets,name)),digest,name);
const out=path.join(p.out,'packaged-renderer-'+Date.now()),home=path.join(out,'helper-home'),roaming=path.join(home,'AppData/Roaming'),profile=path.join(roaming,'Agentopia'),id=randomUUID();await mkdir(profile,{recursive:true});await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution:'AgentopiaRuntime-'+id,instanceId:id}));
const cfg={out,home,roaming,legacy:profile,profile,temp:path.join(out,'temp'),program:p.program,exe:p.exe,imageSha256:p.imageSha256};
const result=await launchDurableProfileProbe(cfg,{label:'actual-renderer',testProfile:false,initialProfile:profile,expectedProfile:profile,isolateOsHome:true,hiddenWindow:true,runMissing:async({page})=>{
 const assets=await page.evaluate(async()=>{const urls=[...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map(element=>element.src||element.href);return Promise.all(urls.map(async url=>{const response=await fetch(url);if(!response.ok)throw Error('Packaged asset could not load');const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);return {pathname:new URL(url).pathname,sha256:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')};}));});
 assert(assets.some(asset=>asset.pathname.endsWith('.js'))&&assets.some(asset=>asset.pathname.endsWith('.css')));for(const asset of assets){const name=asset.pathname.replace(/^\//,'');assert.equal(p.uiFiles[name],asset.sha256,name);}
 assert(await page.locator('#root').innerText());await page.screenshot({path:path.join(out,'actual-packaged-renderer.png'),timeout:30000});return {actualPackagedRenderer:true,loadedAssets:assets,productionProfileWrites:0,providerRequests:0};
}});
assert(result.success&&result.normalExit===0&&result.absentPrivateRuntimeRefused&&result.workflow.actualPackagedRenderer&&result.externalRequestsAttempted===0);q.actualPackagedRendererPending=false;q.actualPackagedRenderer=true;q.packagedRendererEvidence=path.join(result.out,'evidence.json');q.packagedRendererEvidenceSha256=await hash(q.packagedRendererEvidence);q.packagedRendererUsesEmptyIsolatedProfile=true;q.providerRequests=0;await writeFile(path.join(p.out,'qualification.json'),JSON.stringify(q,null,2));console.log(JSON.stringify({success:true,evidence:q.packagedRendererEvidence,actualPackagedRenderer:true,productionProfileWrites:0,providerRequests:0}));
