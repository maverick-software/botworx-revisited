const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const build=process.env.AGENTOPIA_ACCESS_BUILD??path.resolve(__dirname,'../build');
const {protectionEvidence,WorkspaceAccessDiagnostics,protectionQuery}=require(path.join(build,'workspace-access-diagnostics.js'));
const now=Date.parse('2026-10-19T06:15:00Z'),root='D:\\Selected folder',program='C:\\Agentopia\\pwsh.exe';
const event=(extra={})=>({eventId:1123,at:new Date(now-1000).toISOString(),process:program,target:root+'\\public',...extra});
test('only exact managed processes, selected folder boundaries and recent block events establish a refusal',()=>{
 const valid=event(),other=[event({target:root+'-other\\private'}),event({process:'C:\\Other\\pwsh.exe'}),event({eventId:1124}),event({at:new Date(now-31*60000).toISOString()}),event({at:new Date(now+60000).toISOString()})];
 assert.deepEqual(protectionEvidence(root,[...other,valid],[program],now),[{at:valid.at,program:'pwsh.exe'}]);
});
test('case, separators and extended paths match while parent escapes and drive roots do not',()=>{
 assert.equal(protectionEvidence('\\\\?\\D:\\Selected folder',[event({target:'d:/SELECTED FOLDER/public'})],[program.toUpperCase()],now).length,1);
 assert.equal(protectionEvidence(root,[event({target:root+'\\..\\outside'})],[program],now).length,0);
 assert.equal(protectionEvidence('D:\\',[event()],[program],now).length,0);
});
test('matching evidence omits raw paths, account fields and event messages, excludes private relative paths and stays bounded',()=>{
 const rows=Array.from({length:30},(_,i)=>event({at:new Date(now-i*1000).toISOString(),message:'private event text',user:'private user'}));
 const found=protectionEvidence(root,rows,[program],now);assert.equal(found.length,8);assert(!JSON.stringify(found).includes('private'));assert(!JSON.stringify(found).includes('Selected folder'));
 assert.deepEqual(protectionEvidence(root,[event({target:root+'\\.env'})],[program],now,relative=>!relative.startsWith('.')),[]);
 assert.deepEqual(protectionEvidence(root,Array(257).fill(event()),[program],now),[]);
});
test('diagnostics report a confirmed refusal but never claim writable when there is no match or event access fails',async()=>{
 const make=reader=>new WorkspaceAccessDiagnostics('C:\\runtime',{platform:'win32',now:()=>now,reader});
 const blocked=await make(async q=>({available:true,events:[event({process:q.processes[0]})]})).inspect(root);assert.equal(blocked.status,'blocked');assert.equal(blocked.readOnly,true);assert.equal(blocked.provesWritable,false);
 const empty=await make(async()=>({available:true,events:[]})).inspect(root);assert.equal(empty.status,'no_matching_event');assert.equal(empty.provesWritable,false);
 assert.equal((await make(async()=>{throw Error('private system error');}).inspect(root)).status,'unavailable');
 assert.equal((await make(async()=>({available:true,events:null})).inspect(root)).status,'unavailable');
});
test('unsupported hosts, invalid roots and cancellation do not dispatch a query or turn into a permission grant',async()=>{
 let calls=0;const reader=async()=>{calls++;return {available:true,events:[]};};
 assert.equal((await new WorkspaceAccessDiagnostics('C:\\runtime',{platform:'linux',reader}).inspect(root)).status,'unsupported');
 assert.equal((await new WorkspaceAccessDiagnostics('C:\\runtime',{platform:'win32',reader}).inspect('D:\\')).status,'unavailable');assert.equal(calls,0);
 const controller=new AbortController();controller.abort(Error('Account changed'));await assert.rejects(new WorkspaceAccessDiagnostics('C:\\runtime',{reader}).inspect(root,controller.signal),/Account changed/);assert.equal(calls,0);
 const midflight=new AbortController(),pending=new WorkspaceAccessDiagnostics('C:\\runtime',{platform:'win32',reader:async()=>{midflight.abort(Error('Turn cancelled'));return {};}});await assert.rejects(pending.inspect(root,midflight.signal),/Turn cancelled/);
});
test('the fixed query reads events and known-folder aliases without mutation or execution of input text',()=>{
 assert.match(protectionQuery,/Get-WinEvent/);assert.match(protectionQuery,/GetFolderPath/);assert.match(protectionQuery,/\[Console\]::In\.ReadToEnd/);assert.doesNotMatch(protectionQuery,/Invoke-Expression|Set-MpPreference|Add-MpPreference|Set-Item|New-Item|Set-Content|Start-Process/i);
});
