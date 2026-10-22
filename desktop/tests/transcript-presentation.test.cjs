const test=require('node:test'),assert=require('node:assert/strict');
const {previousMessageCount,needsTranscriptAttention,messageTime,transcriptDateLabel,responseText,historyTitle}=require('../build/transcript-presentation.js');
const message=(role,id,metadata={})=>({id,role,content:{text:id},metadata});
test('history folding retains whole exchanges and leaves short chats intact',()=>{
 const rows=Array.from({length:11},(_,n)=>message(n%2?'assistant':'user',String(n)));
 assert.equal(previousMessageCount(rows),10);assert.equal(rows[previousMessageCount(rows)].role,'user');
 assert.equal(previousMessageCount(rows.slice(0,2)),0);
 assert.equal(previousMessageCount(rows.slice(0,10)),8);
 assert.equal(previousMessageCount([]),0);
 assert.equal(previousMessageCount(rows.slice(0,1)),0);
});
test('new prompts compact completed exchanges while live decisions keep their exchange visible',()=>{
 const rows=[message('user','first'),message('assistant','one'),message('user','second')];
 assert.equal(previousMessageCount(rows),2);
 rows.push(message('assistant','two'),message('assistant','report'));assert.equal(previousMessageCount(rows),2);
 rows[1].metadata={status:'running'};assert.equal(previousMessageCount(rows),0);
 rows[1].metadata={tools:[{status:'awaiting_approval'}]};assert.equal(previousMessageCount(rows),0);
 rows[1].metadata={status:'completed'};assert.equal(previousMessageCount(rows),2);
 assert.equal(historyTitle('\n  Review the layout\nAdditional instructions and context'),'Review the layout');
 assert.equal(historyTitle('  '),'Untitled chat');
});
test('background work stays folded while main responses and decisions reveal history',()=>{
 assert(needsTranscriptAttention(message('assistant','running',{status:'running'})));
 assert(needsTranscriptAttention(message('assistant','approval',{tools:[{status:'awaiting_approval'}]})));
 const native={approvals:[],children:[{status:'running',delivery:'queued',state:{approvals:[]}}]};
 assert(!needsTranscriptAttention(message('assistant','child',{native})));
 native.children[0].state.approvals=[{status:'pending'}];assert(needsTranscriptAttention(message('assistant','child-input',{native})));native.children[0].state.approvals=[];
 native.children[0].status='completed';assert(!needsTranscriptAttention(message('assistant','done',{native})));
 native.reports=[{status:'completed',state:{approvals:[],tools:[{status:'awaiting_approval'}]}}];assert(needsTranscriptAttention(message('assistant','report-approval',{native})));native.reports=[];
 native.children[0].delivery='running';assert(!needsTranscriptAttention(message('assistant','report',{native})));
 native.reports=[{status:'failed',error:'Report failed',state:{approvals:[]}}];assert(needsTranscriptAttention(message('assistant','report-failed',{native})));
});
test('copying a completed native reply excludes hidden commentary and child messages',()=>{
 const native={threadId:'parent',items:[{threadId:'parent',item:{type:'agentMessage',phase:'commentary',text:'Working on it.'}},{threadId:'child',item:{type:'agentMessage',text:'Child output'}},{threadId:'parent',item:{type:'agentMessage',phase:'final_answer',text:'The result.'}}]};
 const row={...message('assistant','copy',{native,status:'completed'}),content:{text:'Working on it.\nThe result.'}};
 assert.equal(responseText(row),'The result.');row.metadata.status='running';assert.equal(responseText(row),'Working on it.\n\nThe result.');
 assert.equal(responseText({...message('assistant','goal'),content:{text:'Done.<!-- GOAL_COMPLETE -->'}}),'Done.');
});
const reply=(thread,text,phase='final_answer')=>({threadId:thread,turnId:'turn',completed:true,item:{id:text,type:'agentMessage',phase,text}});
test('copying a completed answer includes each later parent report and its citation in displayed order',()=>{
 const citation='[Saved source](agentopia-chat://generated-chat/message/generated-message)';
 const native={threadId:'parent',items:[reply('parent','Original answer.<!-- GOAL_COMPLETE -->'),reply('child','Private child text')],reports:[
  {id:'one',status:'completed',state:{threadId:'parent',items:[reply('parent','Hidden report work.','commentary'),reply('child','Child transport text'),reply('parent','First report.\n\n'+citation+'<!-- GOAL_COMPLETE -->'),{threadId:'parent',item:{type:'commandExecution',aggregatedOutput:'Tool output'}}]}},
  {id:'two',status:'completed',state:{threadId:'parent',items:[reply('parent','Second report.')]}}
 ]};
 assert.equal(responseText(message('assistant','copy',{native,status:'completed'})),'Original answer.\n\nFirst report.\n\n'+citation+'\n\nSecond report.');
});
test('a report-only answer can be copied even when the initial parent response is empty',()=>{
 const native={threadId:'parent',items:[],reports:[{status:'completed',state:{threadId:'report-thread',items:[reply('report-thread','The saved report answer.')]}}]};
 assert.equal(responseText(message('assistant','copy',{native,status:'completed'})),'The saved report answer.');
});
test('copying streaming reports uses each report status independently of the completed parent',()=>{
 const report={status:'running',state:{threadId:'parent',items:[reply('parent','Current report progress.','commentary'),reply('parent','Saved partial answer.')]}};
 const row=message('assistant','copy',{status:'completed',native:{threadId:'parent',items:[reply('parent','Old progress.','commentary')],reports:[report]}});
 assert.equal(responseText(row),'Current report progress.\n\nSaved partial answer.');
 for(const status of ['completed','cancelled','failed','interrupted']){report.status=status;assert.equal(responseText(row),'Saved partial answer.');}
});
test('copying empty report work omits commentary-only finished attempts and transport activity',()=>{
 const row=message('assistant','copy',{status:'completed',native:{threadId:'parent',items:[],reports:[{status:'completed',state:{threadId:'parent',items:[reply('parent','Hidden','commentary'),reply('child','Other thread'),reply('parent','<!-- GOAL_COMPLETE -->')]}}]}});
 assert.equal(responseText(row),'');
});
test('transcript timestamps use recorded times and do not invent missing dates',()=>{
 const stamp='2026-10-16T16:20:00.000Z',rows=[message('user','u'),message('assistant','a',{timing:{startedAt:stamp}})];
 assert.equal(messageTime(rows,0),stamp);assert.equal(messageTime(rows,1),stamp);assert.equal(messageTime([message('user','missing')],0),undefined);
 assert.equal(messageTime([message('assistant','invalid',{timing:{startedAt:'bad'}})],0),undefined);
 assert(transcriptDateLabel(stamp,new Date(stamp)).startsWith('Today '));assert.equal(transcriptDateLabel('bad'),'');
});
