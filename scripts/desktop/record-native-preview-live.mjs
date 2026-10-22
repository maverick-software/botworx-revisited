import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const id=process.argv[2],phase=process.argv[3];assert(/^\d{13}$/.test(id)&&['retained','stopped'].includes(phase));
const repo=path.resolve(import.meta.dirname,'../..'),out=path.join(repo,'.supabase/desktop-native-independent/ordinary-'+id),intent=JSON.parse(await readFile(path.join(out,'intent.json'))),folder=path.join('C:/Users/charl/AgentopiaWorkspaces','Native preview '+id);
assert.equal(path.resolve(intent.folder),path.resolve(folder));assert.equal(intent.marker,'NATIVE31-'+id);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),captures=[];
for(const name of (await readdir(out)).filter(name=>/^capture-\d+\.json$/.test(name))){const bytes=await readFile(path.join(out,name));captures.push({name,bytes,record:JSON.parse(bytes)});}
captures.sort((a,b)=>a.record.at-b.record.at);const latest=captures.at(-1),request=latest.record.requests[0];assert.equal(request.status,'completed');assert.equal(request.provider,'openai-oauth');assert.equal(request.state.children.length,1);assert.equal(request.state.children[0].status,'completed');assert.equal(request.state.children[0].delivery,'delivered');assert(request.state.reports.length===1&&request.state.reports[0].status==='completed');assert(latest.record.preservedOriginal.originalConversationAndMessageRowsMatched);
const firstCompleted=captures.find(c=>c.record.requests[0]?.state?.reports?.some(r=>r.status==='completed'));assert(firstCompleted);
const state=JSON.parse(await readFile(path.join(folder,'server-state.json')));assert.equal(state.host,'127.0.0.1');assert(Number.isInteger(state.port)&&state.port>1024&&state.port<65536);assert.equal(state.marker,intent.marker);
const url='http://127.0.0.1:'+state.port+'/',record={at:new Date().toISOString(),phase,url,pid:state.pid,capture:latest.name,captureSha256:hash(latest.bytes),secondsSinceObservedReportComplete:Date.now()/1000-firstCompleted.record.at,securitySettingsChanged:false,realOpenRouterRequests:0};
let response,error;try{response=await fetch(url,{signal:AbortSignal.timeout(3000),redirect:'error'});}catch(e){error=e.cause?.code??e.name;}
if(phase==='retained'){
 assert(record.secondsSinceObservedReportComplete>=65,'Observe at least 65 seconds after completed automatic report');assert(response&&response.status===200);const body=await response.text(),disk=await readFile(path.join(folder,'public/index.html'));assert.equal(body, disk.toString());assert(body.includes('<h1 style="color: blue;">STEERED '+intent.marker+'</h1>'));record.httpStatus=200;record.pageSha256=hash(disk);record.headingVerified=true;record.scriptUnchanged=hash(await readFile(path.join(folder,'preview.py')))==='35529ac8607fc9f1972bc646a141d04f1fa4f495b359bd8c29af5027e0c12364';assert(record.scriptUnchanged);
}else{assert(await readFile(path.join(out,'retained.json')));assert(!response&&error==='ECONNREFUSED','Scoped Stop must retire the actual listening server');record.connectionRefused=true;record.error=error;}
await writeFile(path.join(out,phase+'.json'),JSON.stringify(record,null,2),{flag:'wx'});console.log(JSON.stringify(record));
