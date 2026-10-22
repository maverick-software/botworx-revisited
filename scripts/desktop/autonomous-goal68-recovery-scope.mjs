// Exact generated workload boundaries; these do not change product permissions.
export function goal68ToolScope(name,args,state,expected,turnId){
 const allowed=keys=>Object.keys(args).every(key=>keys.includes(key));
 const stage=expected.stages[state.stageIndex??0];if(!stage)throw Error('All generated stages are already complete.');
 const pending=state.pending;
 if(name==='browser_open'&&!pending&&args.url===stage.url&&allowed(['url'])&&turnId!==state.lastStageTurn)return {kind:'open',stage:stage.stage};
 if(name==='browser_snapshot'&&pending?.phase==='opened'&&pending.turnId===turnId&&args.tab_id===pending.tabId&&(args.text_offset??0)===0&&(args.element_offset??0)===0&&allowed(['tab_id','text_offset','element_offset']))return {kind:'snapshot',stage:stage.stage};
 if(name==='write_file'&&pending?.phase==='read'&&pending.turnId===turnId&&args.reference_id===expected.referenceId&&args.path===stage.path&&args.expected_hash===null&&typeof args.content==='string'&&args.content.length<=6000&&typeof args.reason==='string'&&args.reason.trim()&&allowed(['reference_id','path','expected_hash','content','reason'])){
  let receipt;try{receipt=JSON.parse(args.content);}catch{throw Error('A stage receipt must be JSON.');}
  if(Object.keys(receipt).some(key=>!Object.hasOwn(stage.receipt,key))||Object.entries(stage.receipt).some(([key,value])=>receipt[key]!==value))throw Error('The stage receipt does not match the generated source facts and latest user constraints. Inspect this task without repeating completed actions.');
  return {kind:'write',stage:stage.stage};
 }
 if(name==='browser_close'&&pending?.phase==='written'&&pending.turnId===turnId&&args.tab_id===pending.tabId&&allowed(['tab_id']))return {kind:'close',stage:stage.stage};
 throw Error('Only one exact open, snapshot, new receipt and close per stage and native turn are authorized.');
}

export function goal68InferenceScope(state,request,now=Date.now()){
 const x=state.expected;
 if(!state.leaseActive||state.expiresAt<now+90000)throw Error('Fresh access-only authorization required.');
 if(!x||request.owner!==x.owner||request.agentId!==x.agent||request.goalId!==x.goal||state.goalRequest&&request.requestId!==state.goalRequest)throw Error('Inference is outside the generated autonomous goal.');
 if(request.model!=='gpt-6.1-sol'||request.context.length>350000||!request.context.includes(x.marker)||!request.context.includes(x.role)||/data:image\//.test(request.context))throw Error('Owned identity, selected model and bounded text are required.');
 if(state.calls.length>=(x.maximumResponses??80)||state.calls.some(row=>row.inputSha256===request.inputSha256))throw Error('The goal response ceiling or duplicate-input protection stopped this task. Inspect the existing requests.');
 return true;
}
