import assert from 'node:assert/strict';
import {checkContinuity66} from './install-live-continuity66-guard.mjs';
const now=Date.now(),state={leaseActive:true,expiresAt:now+600000,expected:{owner:'owner',agent:'agent',requests:['r1'],marker:'marker',role:'role'},calls:[]},request={owner:'owner',agentId:'agent',requestId:'r1',model:'gpt-6.1-sol',context:'marker role',inputSha256:'first'};
assert(checkContinuity66(state,request,now));
for(const change of [{owner:'other'},{agentId:'other'},{requestId:'other'},{model:'other'},{context:'missing identity'},{context:'marker role data:image/png'}])assert.throws(()=>checkContinuity66(state,{...request,...change},now));
assert.throws(()=>checkContinuity66({...state,leaseActive:false},request,now));assert.throws(()=>checkContinuity66({...state,expiresAt:now},request,now));assert.throws(()=>checkContinuity66({...state,calls:[{inputSha256:'first'}]},request,now));assert.throws(()=>checkContinuity66({...state,calls:Array.from({length:3},()=>({requestId:'r1',inputSha256:'other'}))},request,now));
console.log(JSON.stringify({success:true,checks:11,providerRequests:0}));
