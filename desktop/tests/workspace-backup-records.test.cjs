const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const build=process.env.AGENTOPIA_SCHEDULE_PROJECT_BUILD;assert(build&&path.isAbsolute(build));
const {ScheduledWorkspaces}=require(path.join(build,'scheduled-workspaces.js')),{captureWorkspaceOwnerRecords:capture,validateWorkspaceOwnerRecords:validate,workspaceOwnerRecordsId:recordId}=require(path.join(build,'workspace-backup-records.js'));
const sha=value=>createHash('sha256').update(value).digest('hex'),fingerprint='a'.repeat(64),head='b'.repeat(40),database='c'.repeat(64),now='2026-10-22T12:00:00.000Z';
function fixture(){
 const root=path.resolve(process.env.AGENTOPIA_SCHEDULE_RECOVERY_FIXTURES,'owner-records'),outputs=path.join(root,'owned-copies'),recovery=path.join(root,'private','scheduled-recovery'),owner=randomUUID(),foreign=randomUUID(),run=randomUUID(),id=randomUUID(),source={id:randomUUID(),path:path.join(root,'project'),kind:'folder'},checkout=path.join(outputs,owner,run),common=path.join(source.path,'.git'),gitDirectory=path.join(common,'worktrees','generated-copy');
 const journal={version:1,owner,runId:run,taskId:randomUUID(),requestId:randomUUID(),snapshot:fingerprint,workspace:{mode:'worktree',source,sourceFiles:[source],commonDirectory:common,ref:'refs/heads/main',sourceIdentity:fingerprint,commonIdentity:fingerprint},path:checkout,commit:head,phase:'archived',at:now,rootIdentity:fingerprint,gitDirectory,gitIdentity:fingerprint,gitFileHash:fingerprint,maintenance:id,resolution:{files:[{id:randomUUID(),path:checkout,kind:'folder'}],resolved:{runId:run,path:checkout,commit:head}}};
 const descriptor=file=>({path:file,sha256:fingerprint,manifestSha256:fingerprint,bytes:100,files:1,expandedBytes:100}),directory=path.join(recovery,owner,id),privateGit=path.join(directory,'git'),reference='refs/agentopia/recovery/'+sha([owner,run,id].join(':'));
 const operation={version:1,id,owner,runId:run,createdAt:now,phase:'archived',expiresAt:now,journal:fingerprint,review:{id,runId:run,path:checkout,files:1,bytes:100,recoveryBytes:300,expiresAt:now,hasGit:true},artifact:descriptor(path.join(directory,'workspace.tar.gz')),rootFingerprint:fingerprint,git:{head,commit:head,reference,indexSha256:fingerprint,indexEntries:1,metadataFingerprint:fingerprint,metadata:descriptor(path.join(privateGit,'git-state.tar.gz')),extras:['history.bundle','index.bin','git-state.tar.gz'].map(name=>({name,path:path.join(privateGit,name),size:100,sha256:fingerprint})),policy:{}},gitProgress:{phase:'complete',reference,commit:head},gitDirectory,gitIdentity:fingerprint};
 const makeRestoration=(phase='complete')=>{const id=randomUUID();return {id,phase,path:path.join(outputs,owner,'restored-'+sha(id).slice(0,24)),...(phase==='complete'?{referenceId:randomUUID(),rootIdentity:fingerprint}:{})};};
 operation.restoration=makeRestoration();operation.restorations=[makeRestoration('uncertain')];
 const values={['scheduled-workspace:'+owner+':'+run]:journal,['scheduled-workspace-recovery:'+owner+':'+id]:operation,['provider-credential:openrouter:'+owner]:'DO NOT EXPORT PROVIDER KEY',['preferences:'+owner]:{imageEnabled:false}};let reads=0,writes=0;
 const secrets={get(key){reads++;return structuredClone(values[key]);},set(){writes++;throw Error('No mutation is permitted while capturing owner records');},scheduledWorkspaceIds(owner){return Object.keys(values).filter(key=>key.startsWith('scheduled-workspace:'+owner+':')).map(key=>key.split(':').at(-1));},scheduledWorkspaceRecoveryIds(owner){return Object.keys(values).filter(key=>key.startsWith('scheduled-workspace-recovery:'+owner+':')).map(key=>key.split(':').at(-1));}};
 const workspaces=new ScheduledWorkspaces(secrets,{},outputs),record=()=>capture(secrets,workspaces,recovery,[owner],database),seal=record=>({...record,indexSha256:recordId(record)});return {root,outputs,recovery,owner,foreign,run,id,journal,operation,values,secrets,workspaces,record,seal,makeRestoration,reads:()=>reads,writes:()=>writes};
}
test('workspace owner records preserve complete history, interrupted copies and exact owner identity without settings or credentials',()=>{
 const f=fixture(),before=structuredClone(f.values),record=f.record();assert.equal(record.accounts.length,1);assert.deepEqual(record.accounts[0].journals,[f.journal]);assert.deepEqual(record.accounts[0].operations,[f.operation]);assert.equal(record.databaseManifestSha256,database);assert(!JSON.stringify(record).includes('DO NOT EXPORT'));assert(!JSON.stringify(record).includes('imageEnabled'));assert.deepEqual(validate(JSON.parse(JSON.stringify(record))),record);assert.deepEqual(f.values,before);assert.equal(f.writes(),0);
});
test('workspace owner records only enumerate owners listed by the matching database backup',()=>{
 const f=fixture(),foreignRun=randomUUID(),foreignOp=randomUUID();f.values['scheduled-workspace:'+f.foreign+':'+foreignRun]={private:'FOREIGN JOURNAL'};f.values['scheduled-workspace-recovery:'+f.foreign+':'+foreignOp]={private:'FOREIGN OPERATION'};const record=f.record();assert(!JSON.stringify(record).includes('FOREIGN'));assert(!JSON.stringify(record).includes(f.foreign));assert.equal(f.writes(),0);
});
test('workspace owner records retain an explicitly listed account with no workspaces',()=>{
 const f=fixture(),record=capture(f.secrets,f.workspaces,f.recovery,[f.owner,f.foreign],database);assert.deepEqual(record.accounts[1],{owner:f.foreign,journals:[],operations:[]});assert.equal(record.accounts[0].operations.length,1);
});
test('workspace owner records reject invalid database identities and duplicate accounts before reading saved state',()=>{
 for(const [owners,digest]of [[[randomUUID()],'invalid'],[[null],database]]){const f=fixture();assert.throws(()=>capture(f.secrets,f.workspaces,f.recovery,owners,digest));assert.equal(f.reads(),0);}const f=fixture();assert.throws(()=>capture(f.secrets,f.workspaces,f.recovery,[f.owner,f.owner.toUpperCase()],database));assert.equal(f.reads(),0);
});
test('workspace owner records reject overlapping, whole-drive or control-character storage roots before reading saved state',()=>{
 for(const choose of [f=>f.outputs,f=>path.parse(f.recovery).root,f=>f.recovery+'\0']){const f=fixture();assert.throws(()=>capture(f.secrets,f.workspaces,choose(f),[f.owner],database),/ownership records/);assert.equal(f.reads(),0);}
});
test('workspace owner records preserve uncertain and acknowledged operations without promoting or retrying them',()=>{
 const f=fixture();for(const phase of ['creating','prepared','committing','archived','uncertain','acknowledged']){f.operation.phase=phase;const record=f.record();assert.equal(record.accounts[0].operations[0].phase,phase);assert.equal(f.operation.phase,phase);}assert.equal(f.writes(),0);
});
test('workspace owner records reject cross-account operations and a recovery attached to a missing run',()=>{
 for(const change of [f=>f.operation.owner=f.foreign,f=>f.operation.runId=randomUUID(),f=>f.journal.maintenance=randomUUID()]){const f=fixture();change(f);assert.throws(f.record,/ownership records/);assert.equal(f.writes(),0);}
});
test('workspace owner records reject relabelled private archives, extra files and restoration paths',()=>{
 for(const change of [f=>f.operation.artifact.path=path.join(f.recovery,f.foreign,f.id,'workspace.tar.gz'),f=>f.operation.git.extras[0].path=path.join(f.recovery,f.owner,randomUUID(),'git','history.bundle'),f=>f.operation.restoration.path=path.join(f.outputs,f.foreign,path.basename(f.operation.restoration.path)),f=>f.operation.staged=path.join(f.root,'unrelated'),f=>f.operation.stagedGit=path.join(f.root,'unrelated')]){const f=fixture();change(f);assert.throws(f.record,/ownership records/);}
});
test('workspace owner records retain valid staged removal paths and bind them to their original registration',()=>{
 const f=fixture();f.operation.phase='uncertain';f.operation.staged=path.join(path.dirname(f.journal.path),'.agentopia-archive-'+f.id);f.operation.stagedGit=path.join(path.dirname(f.operation.gitDirectory),'.agentopia-archive-'+f.id);assert.equal(f.record().accounts[0].operations[0].stagedGit,f.operation.stagedGit);assert.equal(f.writes(),0);
});
test('workspace owner records reject duplicate run, operation or restored-copy identities after a recomputed record hash',()=>{
 for(const change of [record=>record.accounts[0].journals.push(record.accounts[0].journals[0]),record=>record.accounts[0].operations.push(record.accounts[0].operations[0]),record=>record.accounts[0].operations[0].restorations.push(record.accounts[0].operations[0].restoration)]){const f=fixture(),record=f.record();change(record);assert.throws(()=>validate(f.seal(record)),/ownership records/);}
});
test('workspace owner records reject unknown credential-shaped fields even when their outer hash is recomputed',()=>{
 for(const pick of [record=>record,record=>record.accounts[0],record=>record.accounts[0].journals[0],record=>record.accounts[0].journals[0].workspace.source,record=>record.accounts[0].journals[0].workspace.sourceFiles[0],record=>record.accounts[0].operations[0],record=>record.accounts[0].operations[0].git,record=>record.accounts[0].operations[0].restoration]){const f=fixture(),record=f.record();pick(record).apiKey='MUST NOT APPEAR';assert.throws(()=>validate(f.seal(record)),/ownership records/);}
});
test('workspace owner records accept equivalent Git for Windows forward-slash metadata paths',()=>{
 const f=fixture();f.journal.gitDirectory=f.journal.gitDirectory.replaceAll('\\','/');f.operation.gitDirectory=f.operation.gitDirectory.replaceAll('\\','/');const record=f.record();assert.equal(record.accounts[0].operations[0].gitDirectory,f.operation.gitDirectory);
});
test('workspace owner records detect changed metadata hashes and reference namespaces',()=>{
 const f=fixture(),record=f.record();record.accounts[0].operations[0].createdAt='2026-10-21T00:00:00.000Z';assert.throws(()=>validate(record),/ownership records/);const altered=f.record();altered.accounts[0].operations[0].git.reference='refs/heads/main';assert.throws(()=>validate(f.seal(altered)),/ownership records/);
});
test('workspace owner records retain legacy unconfirmed restoration receipts and missing pre-removal proof as metadata',()=>{
 const f=fixture();delete f.operation.restoration.rootIdentity;delete f.operation.git.policy;delete f.operation.git.validation;const record=f.record();assert.equal(record.accounts[0].operations[0].restoration.rootIdentity,undefined);assert.equal(f.writes(),0);
});
test('workspace owner records bind an independent validation receipt to its captured history and history policy',()=>{
 const f=fixture(),{gitRecoveryPolicyId}=require(path.join(build,'workspace-git-policy.js'));f.operation.git.validation={version:1,bundleSha256:fingerprint,head,commit:head,reference:f.operation.git.reference,packChecksum:head,policySha256:gitRecoveryPolicyId({}),at:now};assert(f.record());f.operation.git.validation.bundleSha256='d'.repeat(64);assert.throws(f.record,/ownership records/);
});
