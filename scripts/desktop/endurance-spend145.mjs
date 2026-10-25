import {createEnduranceSpend144} from './endurance-spend144.mjs';

// Observe the bytes before forwarding them. A late abort cannot discard usage
// that was already delivered. Model requests and response bytes stay unchanged.
export async function installEnduranceSpend145(application){
 await application.evaluate((_,{factory})=>{
  const req=globalThis.__durableProbeRequire,fs=req('node:fs'),path=req('node:path'),s=globalThis.__validation76,meter=(0,eval)('('+factory+')')(),inner=globalThis.fetch;
  s.maxResponses=1300;s.maxTools=2000;s.billing144=meter.state;s.billingPending144=Promise.resolve();s.billingTrace145={chunks:0,usageCandidates:0,parsed:0};
  const journal=()=>{if(s.out)fs.writeFileSync(path.join(s.out,'paid-usage.json'),JSON.stringify(meter.state,null,2));};
  globalThis.fetch=async(input,args={})=>{
   const url=typeof input==='string'?input:input.url??String(input);if(url!=='https://openrouter.ai/api/v1/responses')return inner(input,args);
   await s.billingPending144;const row=meter.begin(JSON.parse(args.body));journal();
   try{
    const response=await inner(input,args),call=s.calls.at(-1);row.httpStatus=response.status;row.requestId=call?.requestId;row.inputSha256=call?.inputSha256;
    if(!response.body){row.observationError='The provider returned no body; reservation retained.';journal();return response;}
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',settle,cancelled=false;
    s.billingPending144=new Promise(resolve=>{settle=resolve;});
    const record=line=>{s.billingTrace145.usageCandidates++;try{if(meter.finish(row,line+'\n')){s.billingTrace145.parsed++;journal();}}catch(error){row.observationError=String(error.message).slice(0,200);journal();}};
    const consume=(bytes,final=false)=>{s.billingTrace145.chunks++;buffer+=bytes?decoder.decode(bytes,{stream:true}):decoder.decode();let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(line.startsWith('data:')&&line.includes('"usage"'))record(line);}if(final&&buffer){record(buffer);buffer='';}if(buffer.length>4*1024**2){buffer='';row.observationError='Oversized observer line; unobserved usage remains reserved.';journal();}};
    const forward=new ReadableStream({
     async pull(controller){try{const next=await reader.read();if(cancelled){settle();return;}if(next.done){consume(null,true);settle();controller.close();}else{consume(next.value);controller.enqueue(next.value);}}catch(error){row.observationError=String(error.message).slice(0,200);journal();settle();controller.error(error);}},
     async cancel(reason){cancelled=true;try{await reader.cancel(reason);}catch(error){row.observationError=String(error.message).slice(0,200);}finally{consume(null,true);journal();settle();}}
    });
    return new Response(forward,{status:response.status,statusText:response.statusText,headers:response.headers});
   }catch(error){row.status='outcome-unconfirmed';journal();throw error;}
  };
 },{factory:createEnduranceSpend144.toString()});
}
