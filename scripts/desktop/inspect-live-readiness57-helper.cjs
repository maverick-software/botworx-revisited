// Read-only metadata inspection; no credential values leave this process.
const {app,session}=require('electron'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
app.setName('Agentopia');app.setAppUserModelId('com.squirrel.AgentopiaDesktop.Agentopia');
const intentFile=process.env.AGENTOPIA_READINESS_INTENT;
if(!intentFile)throw Error('Readiness intent required');
let blockedNetwork=0;
globalThis.fetch=async()=>{blockedNetwork++;throw Error('Network is disabled during readiness inspection');};
(async()=>{
 const cfg=JSON.parse(await fs.readFile(intentFile,'utf8'));
 if(!/^F:\\Agentopia\\\.supabase\\desktop-live-readiness57\\\d{13}$/.test(cfg.out)||cfg.source!=='F:\\Agentopia-Data\\profiles\\a91a4800-e08f-4440-a4ec-588762d01bfd\\profile')throw Error('Unexpected readiness scope');
 app.setPath('userData',path.join(cfg.out,'profile'));app.setPath('sessionData',path.join(cfg.out,'profile'));app.setPath('appData',path.join(cfg.out,'appData'));app.setPath('temp',path.join(cfg.out,'temp'));
 await app.whenReady();session.defaultSession.webRequest.onBeforeRequest((details,done)=>{blockedNetwork++;done({cancel:true});});
 const {Secrets}=require(path.join(cfg.program,'resources/app.asar/build/secrets.js')),{ImageConnections}=require(path.join(cfg.program,'resources/app.asar/build/image-connections.js')),secrets=new Secrets(cfg.source);
 await secrets.load();const now=Date.now(),owners=[...new Set(Object.keys(secrets.values).map(key=>/^(?:openai|image-generation|image-openai-key|composio-key|composio-state):([a-f0-9-]{36})$/i.exec(key)?.[1]).filter(Boolean))],images=new ImageConnections(secrets);
 const accounts=owners.map(owner=>{
  const connection=secrets.get('openai:'+owner),expiry=Number(connection?.expires_at),present=typeof connection?.access_token==='string'&&!!connection.access_token,scope=!!connection?.scope?.split(' ').includes('chatgpt.tokens.use.direct'),image=images.status(owner),composio=secrets.get('composio-state:'+owner);
  return {owner,chatgpt:{tokenPresent:present,directPlanScope:scope,expiresAt:Number.isFinite(expiry)?new Date(expiry).toISOString():null,expired:present&&Number.isFinite(expiry)&&expiry<=now,freshForTenMinutes:present&&scope&&expiry>now+600000},composio:{projectKeySaved:!!secrets.get('composio-key:'+owner),connectionCount:composio?.connections?.length??0,enabledConnections:composio?.connections?.filter(row=>row.enabled===true).length??0},images:{enabled:image.connection.enabled,provider:image.connection.provider,model:image.connection.model,credentialAvailable:image.credentialAvailable,configured:images.configured(owner)}};
 });
 if(blockedNetwork)throw Error('Unexpected network attempt during read-only inspection');
 await fs.writeFile(path.join(cfg.out,'readiness.json'),JSON.stringify({success:true,checkedAt:new Date(now).toISOString(),accounts,sharedRouterCredentialPresent:!!secrets.get('openrouter')?.key,networkRequests:0,credentialRefreshes:0,credentialValuesReturned:false,sourceWrites:0},null,2),{flag:'wx'});
 app.exit(0);
})().catch(error=>{console.error(error.message);app.exit(1);});
