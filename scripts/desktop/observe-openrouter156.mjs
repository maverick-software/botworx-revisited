import {createEnduranceSpend144} from './endurance-spend144.mjs';

// Metadata only. Prompt, reasoning and argument contents are never journaled.
export function createFunctionAudit156(sha){
 const state={events:[],parseErrors:0},decoder=new TextDecoder();let buffer='';
 const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
 function item(type,value,index){if(!value||!['function_call','custom_tool_call'].includes(value.type))return;const raw=value.type==='custom_tool_call'?value.input:value.arguments,args=typeof raw==='string'?raw:JSON.stringify(raw??{});let parsed;try{parsed=JSON.parse(args);}catch{}state.events.push({event:type,itemType:value.type,index,id:value.id,callId:value.call_id,name:value.name,namespace:value.namespace??null,argumentBytes:new TextEncoder().encode(args).byteLength,argumentsSha256:sha(args),canonicalArgumentsSha256:parsed===undefined?null:sha(JSON.stringify(stable(parsed))),argumentKeys:parsed&&typeof parsed==='object'?Object.keys(parsed).sort():[],zeroSession:parsed?.session_id===0});}
 function line(text){if(!text.startsWith('data:')||text.slice(5).trim()==='[DONE]')return;try{const e=JSON.parse(text.slice(5));if(['response.output_item.added','response.output_item.done'].includes(e.type))item(e.type,e.item,e.output_index);if(['response.completed','response.incomplete','response.failed'].includes(e.type))for(const[i,value]of(e.response?.output??[]).entries())item(e.type,value,i);}catch{state.parseErrors++;}}
 return {state,consume(bytes,final=false){buffer+=bytes?decoder.decode(bytes,{stream:true}):decoder.decode();let at;while((at=buffer.indexOf('\n'))>=0){line(buffer.slice(0,at));buffer=buffer.slice(at+1);}if(final&&buffer){line(buffer);buffer='';}if(buffer.length>4*1024**2){state.parseErrors++;buffer='';}}};
}

export async function installOpenRouterObserver156(application,options={}){
 await application.evaluate((_,{auditFactory,meterFactory,options})=>{
  const req=globalThis.__durableProbeRequire,fs=req('node:fs'),path=req('node:path'),crypto=req('node:crypto'),s=globalThis.__validation76,inner=globalThis.fetch,sha=value=>crypto.createHash('sha256').update(value).digest('hex'),makeAudit=(0,eval)('('+auditFactory+')'),meter=(0,eval)('('+meterFactory+')')(options.meter??{limit:.50});
  s.maxResponses=options.maxResponses??12;s.maxTools=options.maxTools??50;s.audit156=[];s.billing156=meter.state;s.billingPending156=Promise.resolve();
  const journal=()=>{if(s.out){fs.writeFileSync(path.join(s.out,'upstream-function-metadata.json'),JSON.stringify(s.audit156,null,2));fs.writeFileSync(path.join(s.out,'paid-usage.json'),JSON.stringify(meter.state,null,2));}};
  globalThis.fetch=async(input,args={})=>{
   const url=typeof input==='string'?input:input.url??String(input);if(url!=='https://openrouter.ai/api/v1/responses')return inner(input,args);
   await s.billingPending156;const body=JSON.parse(args.body),before=s.calls.length,row=meter.begin(body),audit=makeAudit(sha),flatten=(tools,namespace=null)=>tools.flatMap(t=>t.type==='namespace'?flatten(t.tools,t.name):[{type:t.type,name:t.name,namespace,parameterKeys:Object.keys(t.parameters?.properties??{}).sort(),schemaSha256:sha(JSON.stringify(t.parameters??null))}]),record={sequence:s.audit156.length+1,model:body.model,inputSha256:sha(JSON.stringify(body.input)),catalog:flatten(body.tools??[]),upstream:audit.state};s.audit156.push(record);journal();
   try{
    const response=await inner(input,args);row.httpStatus=response.status;row.requestId=s.calls.at(-1)?.requestId;record.requestId=row.requestId;record.httpStatus=response.status;
    if(!response.body){row.observationError='No body; reservation retained';journal();return response;}
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',settle,cancelled=false;s.billingPending156=new Promise(resolve=>{settle=resolve;});
    const consume=(bytes,final=false)=>{audit.consume(bytes,final);buffer+=bytes?decoder.decode(bytes,{stream:true}):decoder.decode();let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);if(line.startsWith('data:')&&line.includes('"usage"'))meter.finish(row,line+'\n');}if(final&&buffer){meter.finish(row,buffer);buffer='';}if(buffer.length>4*1024**2){row.observationError='Oversized usage line; reservation retained';buffer='';}journal();};
    return new Response(new ReadableStream({async pull(controller){try{const next=await reader.read();if(cancelled){settle();return;}if(next.done){consume(null,true);settle();controller.close();}else{consume(next.value);controller.enqueue(next.value);}}catch(error){row.observationError=String(error.message).slice(0,160);journal();settle();controller.error(error);}},async cancel(reason){cancelled=true;try{await reader.cancel(reason);}finally{consume(null,true);settle();}}}),{status:response.status,statusText:response.statusText,headers:response.headers});
   }catch(error){if(s.calls.length===before){row.status='refused-before-dispatch';row.accounted=0;row.usageKnown=true;record.refusedBeforeDispatch=true;}else row.status='outcome-unconfirmed';journal();throw error;}
  };
 },{auditFactory:createFunctionAudit156.toString(),meterFactory:createEnduranceSpend144.toString(),options});
}
