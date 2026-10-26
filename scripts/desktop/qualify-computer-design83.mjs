// Start the actual candidate program with an empty isolated profile and no runtime.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {computerDesign83Base,computerDesign83Records,verifyComputerDesign83Proof} from './prepare-computer-design83.mjs';

export function verifyComputerDesign83RendererObservation(observation,uiFiles){
 assert(observation.rendererExecuted&&observation.computedCardRadius==='14px');
 assert(observation.assets.some(asset=>asset.kind==='script')&&observation.assets.some(asset=>asset.kind==='stylesheet'));
 for(const asset of observation.assets){const url=new URL(asset.url);assert(url.protocol==='agentopia:'&&url.hostname==='app'&&!url.search&&!url.hash);const name=url.pathname.replace(/^\//,'');assert(/^assets\/[^/]+\.(?:js|css)$/.test(name));assert(/^[0-9a-f]{64}$/.test(asset.sha256));assert.equal(uiFiles[name],asset.sha256,name);assert(asset.kind==='script'&&name.endsWith('.js')||asset.kind==='stylesheet'&&name.endsWith('.css')&&asset.sheetLoaded);}
 assert(observation.rules.some(rule=>rule.selector.includes('.computer-settings .computer-card')&&rule.borderRadius==='14px'));
 assert(observation.rules.some(rule=>/\[data-theme=["']?dark/.test(rule.selector)&&rule.selector.includes('.computer-settings .computer-card')&&rule.backgroundColor==='rgb(36, 36, 36)'));
 assert(observation.rules.some(rule=>rule.selector.includes('.computer-settings .computer-switch input:checked')&&rule.backgroundColor==='rgb(52, 133, 245)'));
}
async function qualify(){
 desktopOperation('qualify actual Computer design83 packaged renderer without production access');
const pointer=await json(path.join(computerDesign83Records,'current.json')),p=await json(pointer.proof),base=await json(computerDesign83Base),q=await json(path.join(p.out,'qualification.json'));verifyComputerDesign83Proof(p,base);assert.equal(await hash(pointer.proof),q.proofSha256);
for(const[name,digest]of Object.entries(p.programFiles))assert.equal(await hash(path.join(p.program,name)),digest,name);for(const[name,digest]of Object.entries(p.resourceFiles))assert.equal(await hash(path.join(p.assets,name)),digest,name);
const out=path.join(p.out,'packaged-renderer-'+Date.now()),home=path.join(out,'helper-home'),roaming=path.join(home,'AppData/Roaming'),profile=path.join(roaming,'Agentopia'),id=randomUUID();await mkdir(profile,{recursive:true});await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution:'AgentopiaRuntime-'+id,instanceId:id}));
const cfg={out,home,roaming,legacy:profile,profile,temp:path.join(out,'temp'),program:p.program,exe:p.exe,imageSha256:p.imageSha256};
const result=await launchDurableProfileProbe(cfg,{label:'actual-renderer',testProfile:false,initialProfile:profile,expectedProfile:profile,isolateOsHome:true,hiddenWindow:true,runMissing:async({page})=>{
 const observation=await page.evaluate(()=>{
  const assets=[...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map(element=>({url:element.src||element.href,kind:element.tagName==='SCRIPT'?'script':'stylesheet',sheetLoaded:element.tagName==='SCRIPT'||!!element.sheet})),rules=[];
  const visit=items=>{for(const rule of items){if(rule.selectorText&&rule.selectorText.includes('.computer-settings'))rules.push({selector:rule.selectorText,borderRadius:rule.style.borderRadius,backgroundColor:rule.style.backgroundColor});if(rule.cssRules)visit(rule.cssRules);}};for(const sheet of document.styleSheets)visit(sheet.cssRules);
  const sample=document.createElement('div');sample.className='computer-settings';sample.style.cssText='position:fixed;left:-10000px;visibility:hidden';const card=document.createElement('div');card.className='computer-card';sample.append(card);document.body.append(sample);const computedCardRadius=getComputedStyle(card).borderRadius;sample.remove();
  const root=document.getElementById('root');return {assets,rules,computedCardRadius,rendererExecuted:!!root?.childElementCount&&!!root.textContent.trim()};
 });
 for(const asset of observation.assets){const url=new URL(asset.url);assert(url.protocol==='agentopia:'&&url.hostname==='app');const name=url.pathname.replace(/^\//,'');assert(Object.hasOwn(p.uiFiles,name));asset.sha256=await hash(path.join(p.ui,name));}
 verifyComputerDesign83RendererObservation(observation,p.uiFiles);
 await page.screenshot({path:path.join(out,'actual-packaged-renderer.png'),timeout:30000});return {actualPackagedRenderer:true,loadedAssets:observation.assets,loadedComputerRules:observation.rules,computedCardRadius:observation.computedCardRadius,rendererExecuted:observation.rendererExecuted,productionProfileWrites:0,providerRequests:0};
}});
assert(result.success&&result.normalExit===0&&result.absentPrivateRuntimeRefused&&result.workflow.actualPackagedRenderer&&result.externalRequestsAttempted===0);q.actualPackagedRendererPending=false;q.actualPackagedRenderer=true;q.packagedRendererEvidence=path.join(result.out,'evidence.json');q.packagedRendererEvidenceSha256=await hash(q.packagedRendererEvidence);q.packagedRendererUsesEmptyIsolatedProfile=true;q.providerRequests=0;await writeFile(path.join(p.out,'qualification.json'),JSON.stringify(q,null,2));console.log(JSON.stringify({success:true,evidence:q.packagedRendererEvidence,actualPackagedRenderer:true,productionProfileWrites:0,providerRequests:0}));

}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))await qualify();
