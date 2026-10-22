const test=require('node:test');
const assert=require('node:assert/strict');
const {Runtime,coreServicesReady,coreServices}=require('../build/runtime.js');
test('readiness requires every core service and permits a stopped optional Studio',()=>{
 const services=coreServices.map(service=>({service,state:'running',health:'healthy'}));
 const state={runtime:'native',readiness:'stopped',services:[...services,{service:'studio',state:'stopped',health:null}]};
 assert(coreServicesReady(state));assert(!coreServicesReady({...state,services:services.slice(1)}));
 assert(!coreServicesReady({...state,services:services.map(s=>s.service==='database'?{...s,health:'unhealthy'}:s)}));
});
test('closing the desktop stops and terminates only its own WSL distribution',async()=>{
 const commands=[];const runtime=new Runtime('unused','unused',()=>{});
 runtime.verified=true;
 runtime.command=async args=>{commands.push(['own-runtime',...args]);return '';};
 runtime.wsl=async args=>{commands.push(args);return '';};
 await runtime.stop();
 assert.deepEqual(commands,[['own-runtime','supabase','stop'],['--terminate','AgentopiaRuntime']]);
 assert(!commands.flat().includes('--shutdown'));assert(!commands.flat().includes('--all'));
});
test('a failed WSL prerequisite produces an actionable setup message',async()=>{
 const runtime=new Runtime('unused','unused',()=>{});runtime.wsl=async()=>{throw new Error('Unavailable')};
 await assert.rejects(runtime.start(),/WSL 2 is required.*restart Windows/i);
});
