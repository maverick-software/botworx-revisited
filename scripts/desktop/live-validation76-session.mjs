import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';

export const callFor=page=>(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
export async function seedValidation76(application,page,out,access,retainedAccount){
 const account=retainedAccount?{email:retainedAccount.email,password:retainedAccount.password}:{email:'validation76-'+randomUUID()+'@qa.invalid',password:'Qa76!'+randomBytes(24).toString('base64url')};
 const owner=await application.evaluate(async(_,{account,out,access,retainedOwner})=>{
  const b=globalThis.__coordination.broker,s=globalThis.__validation76,req=globalThis.__durableProbeRequire,crypto=req('node:crypto'),must=r=>{if(r.error)throw Error(r.error.message);return r.data;};
  const user=must(retainedOwner?await b.admin.auth.admin.getUserById(retainedOwner):await b.admin.auth.admin.createUser({...account,email_confirm:true})).user,role=must(await b.admin.from('roles').select('id').eq('name','admin').single());if(retainedOwner){if(user.id!==retainedOwner||user.email!==account.email)throw Error('The retained QA account changed');must(await b.admin.from('user_roles').select('role_id').eq('user_id',user.id).eq('role_id',role.id).single());}else must(await b.admin.from('user_roles').insert({user_id:user.id,role_id:role.id}));
  const key=crypto.privateDecrypt({key:access.privateKey,oaepHash:'sha256'},Buffer.from(access.envelope.key,'base64')),d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(access.envelope.iv,'base64'));d.setAuthTag(Buffer.from(access.envelope.tag,'base64'));const values=JSON.parse(Buffer.concat([d.update(Buffer.from(access.envelope.ciphertext,'base64')),d.final()]).toString());key.fill(0);
  const routerOnly=access.metadata.routerOnly===true,leaseExpiresAt=routerOnly?Date.parse(access.metadata.leaseExpiresAt):values.connection?.expires_at;
  if(!values.router?.key||!Number.isFinite(leaseExpiresAt)||(routerOnly?(!!values.connection||!Array.isArray(values.models)||values.models.length!==0||leaseExpiresAt<Date.now()+600000||leaseExpiresAt>Date.now()+51*60000):(!values.connection?.access_token||values.connection.refresh_token||leaseExpiresAt<Date.now()+600000)))throw Error('The selected bounded connection lease is invalid');
  const entries=[...(!routerOnly?[['openai:'+user.id,values.connection],['models:openai-oauth:'+user.id,values.models]]:[]),['openrouter',values.router],['models:openrouter:shared',values.routerModels],['openrouter-default','openai/gpt-6.1-sol'],['prefer-chatgpt:'+user.id,!routerOnly],['chatgpt-welcome:'+user.id,true]];
  s.original=entries.map(([key])=>({key,value:b.secrets.get(key),present:b.secrets.get(key)!==undefined}));await b.secrets.setMany(entries);s.owner=user.id;s.out=out;s.expiresAt=leaseExpiresAt;s.leaseActive=true;
  await b.call('auth.signIn',account);await b.terminal.grant(await b.identity(),true);return user.id;
 },{account,out,access,retainedOwner:retainedAccount?.owner??null});
 await writeFile(path.join(out,'private-account.json'),JSON.stringify({...account,owner},null,2),{flag:'wx',mode:0o600});assert.equal((await callFor(page)('auth.state')).identity.id,owner);return owner;
}
export async function releaseValidation76(application){
 return application.evaluate(async()=>{
  const b=globalThis.__coordination.broker,s=globalThis.__validation76;if(!s)return {nothingLeased:true};
  for(const id of Object.keys(s.goalCases??{})){const result=await b.admin.from('desktop_goals').select('status').eq('id',id).eq('user_id',s.owner).single();if(result.data?.status==='running')await b.call('goals.pause',{id}).catch(()=>{});}
  for(const id of Object.keys(s.cases)){const active=b.active.get(id);if(active){await b.call('chat.cancel',{requestId:id}).catch(()=>{});await active.done.catch(()=>{});}}
  if(s.owner&&Object.values(s.cases).some(row=>row.kind==='preview'))await b.previews.stopOwner(s.owner);
  if(s.owner)await b.tools.stopComputer(s.owner);s.leaseActive=false;
  if(s.original)await b.secrets.setMany(s.original.map(row=>[row.key,row.present?row.value:undefined]));
  return {leaseRemoved:!s.leaseActive,oauthCredentialRemoved:!s.owner||!b.secrets.get('openai:'+s.owner),routerCredentialRemoved:!b.secrets.get('openrouter')?.key,calls:s.calls,tools:s.tools,blocked:s.blocked,events:s.events,configs:s.configs};
 });
}
