const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const build=process.env.SYLVANA_GOAL_BUILD,{GoalQueue}=require(path.join(build,'goal-queue.js')),{Broker}=require(path.join(build,'broker.js')),{ChatQueue}=require(path.join(build,'chat-queue.js'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('a goal waits for queue removal and the receiving response to settle before resuming',async()=>{
 const queue=new GoalQueue();let idle=false,finished=false;const work=queue.drain('owner','chat','goal',()=>true,()=>idle,()=>{}).then(value=>{finished=true;return value;});queue.beginSettlement('owner','chat');idle=true;queue.changed('owner','chat');await tick();assert.equal(finished,false);queue.finishSettlement('owner','chat');assert.equal(await work,true);assert.equal(queue.isWaiting('goal'),false);
});
test('failed queued work prevents automatic goal continuation even after the last queue entry is gone',async()=>{
 const queue=new GoalQueue();let idle=false;const work=queue.drain('owner','chat','goal',()=>true,()=>idle,()=>{});work.catch(()=>{});queue.beginSettlement('owner','chat');idle=true;queue.finishSettlement('owner','chat','The queued response was cancelled.');await assert.rejects(work,/cancelled/);assert.equal(queue.isWaiting('goal'),false);
});
test('user cancellation wins over a delayed asynchronous readiness check',async()=>{
 const queue=new GoalQueue();let release;const work=queue.drain('owner','chat','goal',()=>new Promise(resolve=>release=resolve),()=>true,()=>{});queue.cancel('goal');release(true);assert.equal(await work,false);queue.reset('goal');assert.equal(await queue.drain('owner','chat','goal',()=>true,()=>true,()=>{}),true);
});
test('wakeups are scoped to the owner/chat and shutdown can wake every suspended goal',async()=>{
 const queue=new GoalQueue();let valid=true,a=false,b=false;const first=queue.drain('one','chat','g1',()=>valid,()=>false,()=>{}).then(()=>a=true),second=queue.drain('two','chat','g2',()=>valid,()=>false,()=>{}).then(()=>b=true);await tick();valid=false;queue.changed('one','chat');await tick();assert(a);assert.equal(b,false);queue.changed();await Promise.all([first,second]);assert(b);
});
test('duplicate queue events share one native yield operation',async()=>{const queue=new GoalQueue();let release,count=0;const work=()=>{count++;return new Promise(resolve=>release=resolve);};const a=queue.yieldOnce('request',work),b=queue.yieldOnce('request',work);await tick();assert.equal(count,1);release();await Promise.all([a,b]);});

function database(){const tables=new Map();return {tables,from(name){const rows=tables.get(name)??[];tables.set(name,rows);let filters=[],patch;const q={select(){return q},eq(key,value){filters.push([key,value]);return q},update(value){patch=value;return q},single:async()=>({data:perform()[0]??null}),maybeSingle:async()=>({data:perform()[0]??null}),then(resolve,reject){return Promise.resolve({data:perform()}).then(resolve,reject)}};function perform(){const selected=rows.filter(row=>filters.every(([key,value])=>row[key]===value));if(patch)for(const row of selected)Object.assign(row,structuredClone(patch));return selected;}return q;}};}
function fixture(){
 const user={id:randomUUID()},conversation=randomUUID(),goal={id:randomUUID(),agent_id:randomUUID(),user_id:user.id,conversation_id:conversation,objective:'Complete the approved task',status:'running',max_turns:null,token_budget:1000,turns_used:2},db=database(),events=[],starts=[],values=new Map(),broker=Object.create(Broker.prototype);db.tables.set('desktop_goals',[structuredClone(goal)]);
 Object.assign(broker,{admin:db,active:new Map(),startingChats:new Map(),currentOwner:user.id,signedOut:false,closing:false,backingUp:false,scopeChanging:false,startingGoals:new Set(),pausedGoals:new Set(),goals:new Map([[goal.id,Promise.resolve()]]),goalScopes:new Map([[goal.id,conversation]]),tools:{planning:{validateGoal:async()=>{}}},assignments:{interruptGoal:async()=>{},queue:{notify:()=>{}}},native:{stopGoal:async()=>{}},terminal:{sessions:{cancelGoal:async()=>{}}},emit:event=>events.push(event)});
 const queue=new ChatQueue({get:key=>values.get(key),set:async(key,value)=>values.set(key,structuredClone(value))},async(owner,row)=>{starts.push(row.id);const controller=new AbortController();broker.active.set(row.id,{userId:owner,conversationId:conversation,controller});},(owner,chat)=>broker.queueAvailable(owner,chat),(owner,chat)=>broker.emitOwned(owner,{kind:'queue',conversationId:chat,requestId:''}));broker.chatQueue=queue;
 function response(args,status='complete',yielded=false){const message=randomUUID();db.tables.set('desktop_requests',[{id:args.requestId,user_id:user.id,status:'completed'}]);db.tables.set('chat_messages_v2',[{id:message,content:{text:'Confirmed saved result'}}]);db.tables.set('desktop_codex_turns',[{request_id:args.requestId,user_id:user.id,state:{goal:{status},goalTurns:1,goalYielded:yielded}}]);broker.active.set(args.requestId,{userId:user.id,conversationId:conversation,goalId:goal.id,done:Promise.resolve()});queueMicrotask(()=>broker.active.delete(args.requestId));return {conversation_id:conversation,assistant_message_id:message};}
 broker.startChat=async(_,args)=>{starts.push('goal');return response(args);};
 const add=async(id='follow-up')=>queue.add(user.id,{id,conversationId:conversation,agentId:goal.agent_id,text:'Answer this before continuing',options:{permission:'chat',mode:'chat',thinking:'default',files:[]},createdAt:'now',status:'queued'});
 return {broker,user,goal,conversation,db,events,starts,queue,add,response,options:{permission:'chat',mode:'chat',thinking:'default',files:[]}};
}
test('the broker drains queued human work before a goal and resumes using the existing goal and allowance',async()=>{
 const f=fixture();await f.add();let ended=false;const work=f.broker.runGoal(f.user,f.goal,f.options).then(()=>ended=true);await tick();assert.deepEqual(f.starts,['follow-up']);assert.equal(ended,false);assert.equal(f.db.tables.get('desktop_goals')[0].status,'running');
 f.broker.goalQueue.beginSettlement(f.user.id,f.conversation);f.broker.active.delete('follow-up');f.broker.goalQueue.finishSettlement(f.user.id,f.conversation);await work;assert.deepEqual(f.starts,['follow-up','goal']);assert.equal(f.goal.turns_used,3);assert.equal(f.goal.token_budget,1000);assert.equal(f.goal.id,f.db.tables.get('desktop_goals')[0].id);assert.equal(f.goal.status,'completed');
});
test('user Pause during a queued response keeps that response alive and prevents a resumed goal',async()=>{
 const f=fixture();f.broker.identity=async()=>f.user;f.broker.workspaceMonitor={generation:0};await f.add();const work=f.broker.runGoal(f.user,f.goal,f.options);await tick();const controller=f.broker.active.get('follow-up').controller;await f.broker.call('goals.pause',{id:f.goal.id});await work;assert.equal(controller.signal.aborted,false);assert.deepEqual(f.starts,['follow-up']);assert.equal(f.goal.status,'paused');
});
test('a failed queued response pauses the saved goal and never starts its continuation',async()=>{
 const f=fixture();await f.add();const work=f.broker.runGoal(f.user,f.goal,f.options);await tick();f.broker.goalQueue.beginSettlement(f.user.id,f.conversation);f.broker.active.delete('follow-up');f.broker.goalQueue.finishSettlement(f.user.id,f.conversation,'The queued response failed.');await work;assert.equal(f.goal.status,'paused');assert.equal(f.goal.note,'The queued response failed.');assert.deepEqual(f.starts,['follow-up']);
});
test('a native queue yield retains running goal intent and counts only its actual goal turns',async()=>{
 const f=fixture();let count=0;f.broker.startChat=async(_,args)=>{if(count++===0){await f.add();return f.response(args,'paused',true);}f.starts.push('goal');return f.response(args);};const work=f.broker.runGoal(f.user,f.goal,f.options);await tick();assert(f.starts.includes('follow-up'));f.broker.goalQueue.beginSettlement(f.user.id,f.conversation);f.broker.active.delete('follow-up');f.broker.goalQueue.finishSettlement(f.user.id,f.conversation);await work;assert.equal(count,2);assert.equal(f.goal.turns_used,4);assert.equal(f.goal.status,'completed');
});
test('marking a suspended goal complete leaves the queued user response running and prevents continuation',async()=>{
 const f=fixture();f.broker.identity=async()=>f.user;f.broker.workspaceMonitor={generation:0};await f.add();const work=f.broker.runGoal(f.user,f.goal,f.options);await tick();const controller=f.broker.active.get('follow-up').controller;await f.broker.call('goals.complete',{id:f.goal.id});await work;assert.equal(controller.signal.aborted,false);assert.equal(f.db.tables.get('desktop_goals')[0].status,'completed');assert.deepEqual(f.starts,['follow-up']);
});
test('starting another goal in the same chat cannot enter the suspended goal and queue',async()=>{
 const f=fixture(),second={...f.goal,id:randomUUID(),status:'paused'};f.db.tables.get('desktop_goals').push(second);await assert.rejects(f.broker.startGoal(f.user,second.id,f.options),/Another goal/);assert.equal(second.status,'paused');assert.equal(f.broker.startingGoals.size,0);
});
test('concurrent different goals reserve their shared chat before asynchronous setup',async()=>{
 const f=fixture(),second={...f.goal,id:randomUUID(),status:'paused'};f.broker.goals.clear();f.broker.goalScopes.clear();f.db.tables.get('desktop_goals').push(second);let release,entered;
 const setup=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);f.broker.tools.planning.validateGoal=async()=>{entered();await gate;};
 const first=f.broker.startGoal(f.user,f.goal.id,f.options);await setup;await assert.rejects(f.broker.startGoal(f.user,second.id,f.options),/Another goal/);assert.equal(second.status,'paused');release();await first;await f.broker.goals.get(f.goal.id);assert.equal(f.broker.startingGoals.size,0);
});
test('a failed queue pump cleans its waiting state and listeners without an automatic retry',async()=>{
 const queue=new GoalQueue();await assert.rejects(queue.drain('owner','chat','goal',()=>true,()=>false,()=>{throw Error('Queue storage failed');}),/storage failed/);assert.equal(queue.isWaiting('goal'),false);assert.equal(queue.listeners.size,0);
});
