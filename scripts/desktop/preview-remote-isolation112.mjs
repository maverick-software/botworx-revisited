import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const until=async(test,label)=>{const end=Date.now()+60000;while(!await test()&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,25));assert(await test(),label);};
export async function qualifyPreviewRemoteIsolation({broker,owner,agentId,connection,peerConnection,value,discover,code,notes,file,call,saved,check,e,startNative,pending,settle}){
 await check('An accepted default preview retains its exact sources through connection addition, unrelated disable and Composio project removal, then completes its reviewed real HTTP action.',async()=>{
  const request=value(),before=notes.length,note='Accepted default connection isolation112';delete request.snapshot.execution.tools;
  await startNative('default-connections-isolation112',request,[{code:discover},{code:code(note),require:['record_note']},{text:'DEFAULT-CONNECTIONS-ISOLATED112',require:[note,'Recorded']}]);const review=await pending(request),accepted=(await saved(request)).execution_context.remoteTools;
  assert.deepEqual(accepted.sources.map(row=>row.id).sort(),['mcp:'+connection,'mcp:'+peerConnection].sort());
  const added=(await call('agentSettings.mcp.save',{agentId,name:'Later unrelated connection112',url:'http://127.0.0.1:1/mcp'})).id;
  await call('agentSettings.mcp.enable',{agentId,id:added,enabled:false});await call('composio.project.remove');assert.equal((await saved(request)).status,'running');assert.equal(notes.length,before);
  await call('agentDraftPreview.tools.decide',{sessionId:request.sessionId,requestId:request.requestId,id:review.id,approved:true});await settle();const row=await saved(request);assert.equal(row.status,'completed',row.error);assert.deepEqual(row.execution_context.remoteTools,accepted);assert(!row.execution_context.remoteTools.sources.some(source=>source.id==='mcp:'+added));assert.equal(notes.length,before+1);assert.equal(await readFile(file,'utf8'),note);e.acceptedDefaultAdditionVerified=true;
 });
 const service=broker.composio,client=service.client,keyName='composio-key:'+owner,stateName='composio-state:'+owner,previousKey=broker.secrets.get(keyName),previousState=broker.secrets.get(stateName);let accountReads=0,catalogReads=0;
 try{
  for(const action of ['composio.configure','composio.project.remove'])await check(action+': actual native Composio work is cancelled while an ordinary MCP preview finishes independently.',async()=>{
   const namespace=randomUUID(),id=randomUUID(),key='GENERATED-COMPOSIO-ISOLATION112-'+randomUUID(),account={id:'generated_account112',toolkit:'gmail',userId:'agentopia_'+createHash('sha256').update(JSON.stringify([owner,namespace])).digest('hex'),authConfigId:'generated_auth112',scheme:'OAUTH2',status:'ACTIVE',disabled:false};
   await broker.secrets.setMany([[keyName,key],[stateName,{namespace,configurations:{},connections:[{id,toolkit:account.toolkit,name:'Generated Composio isolation112',scheme:account.scheme,authConfigId:account.authConfigId,accountId:account.id,status:'ACTIVE',enabled:true,agents:[agentId]}]}]]);
   service.client=()=>({account:async selected=>{assert.equal(selected,account.id);accountReads++;return account;},catalog:async()=>{catalogReads++;return {items:[],nextCursor:null,total:0,fetchedAt:new Date().toISOString()};}});
   const target=value('openai-oauth','ask',['mcp:'+id]),peer=value('openai-oauth','ask',['mcp:'+peerConnection]),held={};
   const hold=label=>signal=>new Promise((resolve,reject)=>{held[label]={release:resolve,aborted:false};const stop=()=>{held[label].aborted=true;reject(new DOMException('Generated project change112','AbortError'));};if(signal.aborted)stop();else signal.addEventListener('abort',stop,{once:true});});
   try{
    await startNative('project-independent-'+action,peer,[{text:'Ordinary connection completes112',hold:hold('peer')}]);await until(()=>!!held.peer,'Ordinary native request did not reach its held response');
    await startNative('project-affected-'+action,target,[{text:'Affected Composio response112',hold:hold('target')}]);await until(()=>!!held.target,'Composio native request did not reach its held response');assert.equal((await saved(target)).execution_context.remoteTools.sources[0].plugin,'composio');
    await call(action,action==='composio.configure'?{key:key+'-replacement'}:undefined);assert.equal((await saved(target)).status,'cancelled');assert(held.target.aborted);assert(!held.peer.aborted);assert.equal((await saved(peer)).status,'running');held.peer.release();await settle();assert.equal((await saved(peer)).status,'completed');
    (e.remoteProjectIsolation??=[]).push({action,target:target.requestId,peer:peer.requestId,targetCancelled:true,peerCompleted:true});
   }finally{for(const row of Object.values(held))row.release();await broker.previews.stopOwner(owner);}
  });
  assert(accountReads>0);assert.equal(catalogReads,1);e.remoteProjectControlledAccountReads=accountReads;e.remoteProjectControlledCatalogReads=catalogReads;e.remoteProjectIsolationVerified=true;e.liveComposioAuthenticationVerified=false;
 }finally{service.client=client;await broker.secrets.setMany([[keyName,previousKey],[stateName,previousState]]);}
}
