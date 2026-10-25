// QA-only accounting. No changes to product requests, provider defaults or production files.
export function createEnduranceSpend144({limit=3,model='openai/gpt-5-mini',context=400000,output=128000,inputRate=.25,outputRate=2,cacheRate=.025}={}){
 const reserve=context*inputRate/1e6+output*outputRate/1e6;
 const s={limit,model,reserve,inputRate,outputRate,cacheRate,rows:[],stopped:false};
 const total=()=>s.rows.reduce((n,r)=>n+r.accounted,0);
 return {state:s,total,
  begin(body){if(s.stopped)throw Error('OpenRouter endurance dispatch is stopped');if(body.model!==model)throw Error('Unexpected paid model');if(total()+reserve>limit+1e-9){s.stopped=true;throw Error('OpenRouter endurance spending allowance reached before dispatch');}const row={at:new Date().toISOString(),accounted:reserve,usageKnown:false,status:'reserved'};s.rows.push(row);return row;},
  finish(row,text){
   let result;try{result=JSON.parse(text);}catch{for(const line of text.split(/\r?\n/)){if(!line.startsWith('data:'))continue;try{const event=JSON.parse(line.slice(5));if(['response.completed','response.incomplete','response.failed'].includes(event.type)&&event.response?.usage)result=event.response;}catch{}}}
   const u=result?.usage;if(!u||!Number.isSafeInteger(u.input_tokens)||u.input_tokens<0||!Number.isSafeInteger(u.output_tokens)||u.output_tokens<0)return false;
   const cached=u.input_tokens_details?.cached_tokens??0;if(!Number.isSafeInteger(cached)||cached<0||cached>u.input_tokens)return false;
   const computed=((u.input_tokens-cached)*inputRate+cached*cacheRate+u.output_tokens*outputRate)/1e6,reported=typeof u.cost==='number'&&Number.isFinite(u.cost)&&u.cost>=0?u.cost:0;
   row.accounted=Math.max(computed,reported);row.usageKnown=true;row.status=result.status??'usage-received';row.inputTokens=u.input_tokens;row.cachedTokens=cached;row.outputTokens=u.output_tokens;row.reportedCost=reported;row.finishedAt=new Date().toISOString();if(row.accounted>reserve+1e-9){s.stopped=true;throw Error('Reported usage exceeds the validated maximum response reservation');}return true;
  }
 };
}

export async function installEnduranceSpend144(application){
 await application.evaluate((_,{factory})=>{
  const fs=globalThis.__durableProbeRequire('node:fs'),path=globalThis.__durableProbeRequire('node:path'),s=globalThis.__validation76,meter=(0,eval)('('+factory+')')(),inner=globalThis.fetch;
  s.maxResponses=1300;s.maxTools=2000;s.billing144=meter.state;s.billingPending144=Promise.resolve();
  const journal=()=>{if(s.out)fs.writeFileSync(path.join(s.out,'paid-usage.json'),JSON.stringify(meter.state,null,2));};
  globalThis.fetch=async(input,args={})=>{
   const url=typeof input==='string'?input:input.url??String(input);if(url!=='https://openrouter.ai/api/v1/responses')return inner(input,args);
   await s.billingPending144;const row=meter.begin(JSON.parse(args.body));journal();
   try{const response=await inner(input,args);row.httpStatus=response.status;const call=s.calls.at(-1);row.requestId=call?.requestId;row.inputSha256=call?.inputSha256;
    s.billingPending144=response.clone().text().then(text=>{meter.finish(row,text);journal();}).catch(error=>{row.observationError=String(error.message).slice(0,200);journal();});return response;
   }catch(error){row.status='outcome-unconfirmed';journal();throw error;}
  };
 },{factory:createEnduranceSpend144.toString()});
}
