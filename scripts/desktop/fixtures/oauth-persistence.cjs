const {app,BrowserWindow,safeStorage}=require('electron'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.AGENTOPIA_OAUTH_PERSIST_OUTPUT),root=path.resolve(__dirname,'../../..'),modules=path.resolve(process.env.AGENTOPIA_OAUTH_MODULES);
assert(out.startsWith(path.join(root,'.supabase')+path.sep));app.setName('OAuth persistence verification');app.setPath('userData',path.join(out,'profile'));globalThis.done=false;
app.whenReady().then(async()=>{
 const window=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});await window.loadURL('data:text/html,Controlled OAuth persistence verification');
 const phase=process.env.AGENTOPIA_OAUTH_PHASE,result={phase,success:false,tokenRequests:0,keyRequests:0};
 try{
  assert(safeStorage.isEncryptionAvailable());const fixture=JSON.parse(await fs.readFile(path.join(out,'fixture.json'),'utf8')),{Secrets}=require(path.join(modules,'secrets.js')),{Providers}=require(path.join(modules,'providers.js')),secrets=new Secrets(app.getPath('userData'));await secrets.load();
  if(phase==='receive')await secrets.set('openai:owner',{client_id:'oaiapp_fixture',subject:'fixture-subject',email:'fixture@example.com',id_token:'fixture-old-identity',access_token:'fixture-old-access',refresh_token:'fixture-old-refresh',scope:'openid offline_access chatgpt.tokens.use.direct',expires_at:0});
  const providers=new Providers(secrets,'urn:uuid:fixture-host');
  global.fetch=async input=>{const url=String(input);if(url==='https://auth.openai.com/api/accounts/oauth/token'){result.tokenRequests++;if(phase==='receive')return Response.json({access_token:'fixture-new-access',refresh_token:'fixture-new-refresh',expires_in:3600,id_token:fixture.idToken});if(phase==='terminal')return Response.json({error:'invalid_grant'},{status:400});throw Error('A saved rotation or terminal failure must not refresh again.');}assert.equal(url,'https://auth.openai.com/.well-known/jwks.json');result.keyRequests++;return phase==='receive'?new Response('{}',{status:503}):Response.json({keys:[fixture.publicKey]});};
  if(phase==='receive'){
   await assert.rejects(providers.token('openai-oauth','owner'),/Check your internet/);assert.equal(secrets.get('openai:owner').access_token,'fixture-old-access');assert.equal(secrets.get('openai-renewal:owner').connection.refresh_token,'fixture-new-refresh');assert.equal(result.tokenRequests,1);result.rotationJournaledBeforeIdentityLookupCompleted=true;
  }else if(phase==='restore'){
   assert.equal(await providers.token('openai-oauth','owner'),'fixture-new-access');assert.equal(result.tokenRequests,0);assert.equal(secrets.get('openai:owner').refresh_token,'fixture-new-refresh');assert.equal(secrets.get('openai-renewal:owner'),undefined);result.savedRotationRecoveredWithoutSecondRefresh=true;
  }else if(phase==='terminal'){
   await secrets.set('openai:owner',{...secrets.get('openai:owner'),expires_at:0});await assert.rejects(providers.token('openai-oauth','owner'),/Continue with ChatGPT/);assert.equal(result.tokenRequests,1);assert.equal(secrets.get('openai:owner').access_token,'');assert.equal(secrets.get('openai:owner').refresh_token,'');assert.equal(secrets.get('openai-registration:owner').client_id,'oaiapp_fixture');result.unusableTokensClearedWithRegistrationRetained=true;
  }else{
   assert.equal(phase,'reopen');assert.equal(providers.status('owner').chatgpt.authorized,false);assert.equal(providers.status('owner').chatgpt.connectionIssue.code,'invalid_grant');await assert.rejects(providers.token('openai-oauth','owner'),/Continue with ChatGPT/);assert.equal(result.tokenRequests,0);result.reconnectStateRestoredWithoutReusingRejectedCredential=true;
  }
  const bytes=await fs.readFile(path.join(app.getPath('userData'),'credentials.bin'));for(const value of ['fixture-old-access','fixture-new-access','fixture-old-refresh','fixture-new-refresh',fixture.idToken])assert(!bytes.includes(Buffer.from(value)));result.actualWindowsEncryption=true;result.success=true;
 }catch(error){result.error=error.message;}
 await fs.writeFile(path.join(out,'phase-'+phase+'.json'),JSON.stringify(result,null,2),{flag:'wx'});globalThis.done=true;
});
app.on('window-all-closed',()=>app.quit());
