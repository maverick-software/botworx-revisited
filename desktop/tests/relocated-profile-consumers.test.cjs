const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),{randomUUID}=require('node:crypto'),{mkdtemp,mkdir,writeFile,readFile,rm,access}=require('node:fs/promises'),{pathToFileURL}=require('node:url');
const build=process.env.SYLVANA_PROFILE_TEST_BUILD||path.resolve(__dirname,'../build'),{capturePublicReferenceIndex,translateRecoveredPath}=require(path.join(build,'public-file-recovery.js')),{ChatFiles}=require(path.join(build,'chat-files.js')),{WorkspaceFiles}=require(path.join(build,'workspace.js'));
test('portable output indexes accept the verified local-drive profile layout while rejecting arbitrary foreign origins',()=>{
 const publicRoot='C:\\Users\\Alice\\Sylvana Files',profile='F:\\Sylvana-Data\\profiles\\12345678-1234-4123-8123-123456789abc\\profile',inventory={files:{},directories:[]};assert.equal(capturePublicReferenceIndex(publicRoot,profile,[],inventory).sourceProfile,profile);
 for(const other of ['F:\\Public\\profile','\\\\server\\share\\profile','F:\\Sylvana-Data\\profiles\\invalid\\profile','F:\\Sylvana-Data\\profiles\\12345678-1234-4123-8123-123456789abc\\profile\\elsewhere'])assert.throws(()=>capturePublicReferenceIndex(publicRoot,other,[],inventory),/origin/);
});
test('restoring a relocated profile translates earlier private links only within the original home and owner',()=>{
 const owner=randomUUID(),other=randomUUID(),home='C:\\Users\\Alice',publicRoot=path.join(home,'Sylvana Files'),profile='F:\\Sylvana-Data\\profiles\\12345678-1234-4123-8123-123456789abc\\profile',index=capturePublicReferenceIndex(publicRoot,profile,[],{files:{},directories:[]}),native='G:\\Recovered\\private-profile',outputs='G:\\Recovered\\Sylvana Files',branch=randomUUID()+'-'+ 'a'.repeat(32),suffix=path.join(branch,'Report.docx');
 for(const prior of [profile,path.join(home,'.sylvana/desktop/profile'),path.join(home,'AppData/Roaming/Sylvana')]){
  assert.equal(translateRecoveredPath(index,owner,path.join(prior,'workspaces',owner,suffix),outputs,native),path.join(native,'workspaces',owner,suffix));
  const foreign=path.join(prior,'workspaces',other,suffix);assert.equal(translateRecoveredPath(index,owner,foreign,outputs,native),foreign);
 }
 for(const prior of ['C:\\Users\\Bob\\.sylvana\\desktop\\profile','C:\\Users\\AliceElsewhere\\.sylvana\\desktop\\profile']){const foreign=path.join(prior,'workspaces',owner,suffix);assert.equal(translateRecoveredPath(index,owner,foreign,outputs,native),foreign);}
});
async function fixture(run){const root=await mkdtemp(path.join(os.tmpdir(),'relocated-output54-')),native=path.join(root,'new-private'),owner=randomUUID(),conversation=randomUUID(),scope='a'.repeat(32),branch=conversation+'-'+scope,scratch=path.join(native,'workspaces',owner,branch),old=[path.join(root,'old-home/AppData/Roaming/Sylvana'),path.join(root,'old-home/.sylvana/desktop/profile')],exports=path.join(root,'outputs');await mkdir(scratch,{recursive:true});const secrets={rows:new Map(),get(k){return this.rows.get(k)},async set(k,v){this.rows.set(k,v)}},files=new WorkspaceFiles(secrets,undefined,[native,...old]);
 const service=offered=>{
  const database={from(table){
   const query={select(){return this},eq(){return this},order(){return this},limit(){return this},maybeSingle(){return this},then(resolve){return Promise.resolve({data:table==='conversation_sessions'?{conversation_id:conversation}:table==='chat_messages_v2'?[{content:{text:offered}}]:table==='desktop_codex_threads'?[{scope}]:[],error:null}).then(resolve)}};
   return query;
  }};
  return new ChatFiles(database,files,native,exports,undefined,old);
 };
 try{await run({root,native,owner,conversation,scope,branch,scratch,old,exports,files,service});}finally{assert.equal(path.dirname(root),os.tmpdir());assert(path.basename(root).startsWith('relocated-output54-'));await rm(root,{recursive:true,force:true});}
}
test('saved output links from both prior private-profile locations open the current owned copy after relocation',()=>fixture(async f=>{
 await writeFile(path.join(f.scratch,'Report.txt'),'CURRENT COPIED OUTPUT');
 for(const root of f.old){const old=path.join(root,'workspaces',f.owner,f.branch,'Report.txt'),href=pathToFileURL(old).href;await assert.rejects(access(old));const result=await f.service('[Report]('+href+')').resolve(f.owner,{conversationId:f.conversation,href},async()=>{});assert.equal(result.kind,'file');assert.equal(await readFile(f.files.list(f.owner).find(row=>row.id===result.referenceId).path,'utf8'),'CURRENT COPIED OUTPUT');await assert.rejects(access(old));}
}));
test('multiple profile aliases still require the current chat branch and a link actually offered by the agent',()=>fixture(async f=>{
 const other=randomUUID()+'-'+f.scope,file=path.join(f.native,'workspaces',f.owner,other,'Other.txt');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,'OTHER CHAT');const href=pathToFileURL(path.join(f.old[1],'workspaces',f.owner,other,'Other.txt')).href;await assert.rejects(f.service('[Other]('+href+')').resolve(f.owner,{conversationId:f.conversation,href},async()=>{}),/another chat workspace/);await assert.rejects(f.service('No links were offered').resolve(f.owner,{conversationId:f.conversation,href},async()=>{}));assert.deepEqual(f.files.list(f.owner),[]);
}));
