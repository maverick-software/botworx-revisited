import assert from 'node:assert/strict';
import path from 'node:path';
import {hash} from './phased-backup-control.mjs';

// Run the unchanged database-dependent case against the owned QA backend.
// Its legacy CLI status lookup is replaced with that backend's in-memory
// settings. No credential values cross the evaluator boundary or enter files.
export async function verifyChromeReceipts60({application,cfg,proof,out,check}){
 const file=path.join(proof.source,'tests/chrome-receipts.test.cjs');assert.equal(await hash(file),proof.sourceHashes['tests/chrome-receipts.test.cjs']);
 const result=await application.evaluate(async(_,{file,out,owner,distribution})=>{
  const main=globalThis.__coordination.broker,load=globalThis.__durableProbeRequire,app=globalThis.__durableProbeElectron.app,root=app.getAppPath(),path=load('node:path'),fs=load('node:fs/promises'),vm=load('node:vm');
  if((await main.identity()).id!==owner||distribution==='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd')throw Error('Receipt acceptance requires the owned isolated account/runtime.');
  const env={API_URL:main.admin.supabaseUrl,SERVICE_ROLE_KEY:main.admin.supabaseKey,ANON_KEY:main.auth.supabaseKey};
  if(!/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(env.API_URL)||!env.SERVICE_ROLE_KEY||!env.ANON_KEY)throw Error('The owned local database configuration is unavailable.');
  const {Broker}=load(root+'/build/broker.js'),tasks=[],stages=[];let statusReads=0;
  const record=(stage,result)=>{if(result?.error)stages.push({stage,error:String(result.error.message??result.error).slice(0,500)});else stages.push({stage,success:true});return result;};
  class ReceiptBroker extends Broker{
   constructor(...args){super(...args.slice(0,4),[],path.join(out,'receipt-fixture','attachments'),path.join(path.dirname(root),'resources/runtime/terminal.ps1'));}
   async call(action,args={}){try{const result=await super.call(action,['chat.start','goals.start'].includes(action)?{...args,options:{...args.options,harness:'legacy'}}:args);record('broker.'+action);return result;}catch(error){record('broker.'+action,{error});throw error;}}
  }
  const testRequire=name=>{
   if(name==='node:test')return (_name,run)=>tasks.push(run);
   if(name==='./test-backend.cjs')return {testDistribution:()=>distribution};
   if(name==='node:child_process')return {execFileSync:(command,args)=>{if(command!=='wsl.exe'||args.join('|')!==['-d',distribution,'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stack','status','--output-format','json'].join('|'))throw Error('Unplanned receipt fixture process');statusReads++;return JSON.stringify({env});}};
   if(name==='./legacy-harness.cjs')return {Broker:ReceiptBroker};
   if(name.startsWith('../build/'))return load(root+'/build/'+name.slice('../build/'.length));
   if(name==='@supabase/supabase-js'){
    const sdk=load(name);
    return {...sdk,createClient:(...args)=>{
     const client=sdk.createClient(...args);
     for(const name of ['createUser','deleteUser']){const original=client.auth.admin[name].bind(client.auth.admin);client.auth.admin[name]=async(...values)=>record('auth.'+name,await original(...values));}
     const rpc=client.rpc.bind(client);client.rpc=async(name,args)=>record('rpc.'+name,await rpc(name,args));return client;
    }};
   }
   if(['node:assert/strict','node:crypto'].includes(name))return load(name);
   throw Error('Unplanned receipt fixture import: '+name);
  };
  const source=await fs.readFile(file,'utf8');vm.runInNewContext(source,{require:testRequire,setTimeout,Buffer},{filename:file,timeout:10000});if(tasks.length!==1)throw Error('Unexpected Chrome receipt fixture count');try{await tasks[0]();}finally{await fs.writeFile(path.join(out,'receipt-fixture-stages.json'),JSON.stringify(stages,null,2));}
  if(statusReads!==1||globalThis.__coordination.broker!==main||(await main.identity()).id!==owner)throw Error('The original QA account changed during receipt acceptance.');
  return {success:true,actualDatabase:true,testBodyUnmodified:true,controlledToolDispatch:true,legacyStatusReadReplacedWithOwnedBackend:true,newModelRequests:0};
 },{file,out,owner:cfg.owner,distribution:cfg.distribution});
 assert(result.success&&result.actualDatabase&&result.testBodyUnmodified);await check('The unchanged Chrome receipt case passes against the isolated real database: one review, exact arguments, racing-call deduplication and distinct child-thread receipts.');
 return result;
}
