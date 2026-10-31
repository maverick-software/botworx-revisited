import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Secrets} from './secrets';
import type {SessionPersistence} from './session-persistence';
import type {SylvanaAccount,SylvanaConnection} from './sylvana-account';

const checked=<T extends {data:unknown;error:any}>(result:T):NonNullable<T['data']>=>{if(result.error)throw Error('The desktop account service could not finish web sign-in. Retry when it is available.');return result.data as NonNullable<T['data']>;};
/** The caller has verified the browser identity. No renderer-provided local
 * credential is accepted here. Keep SDK persistence suspended until both
 * credentials and their profile binding are published in one encrypted write. */
export async function establishWebSession(input:{connection:SylvanaConnection;account:SylvanaAccount;auth:SupabaseClient;admin:SupabaseClient;secrets:Pick<Secrets,'setMany'>;persistence:SessionPersistence;guard:()=>void}){
 const {connection:c,account,auth,admin,secrets,persistence,guard}=input;
 guard();account.publication(c);persistence.suspend();let issued=false;
 try{
  let local=await admin.auth.admin.getUserById(c.owner);guard();
  if(local.error&&local.error.status!==404)throw Error('The existing desktop identity could not be verified.');
  if(!local.data.user){
   const first=checked(await admin.auth.admin.listUsers({page:1,perPage:1})).users.length===0;guard();
   const created=checked(await admin.auth.admin.createUser({id:c.owner,email:c.email,password:randomUUID()+randomUUID(),email_confirm:true,user_metadata:{first_name:c.email.split('@')[0]}})).user;guard();
   if(created?.id!==c.owner)throw Error('The desktop identity could not be preserved.');
   if(first){const role=checked(await admin.from('roles').select('id').eq('name','admin').single());guard();checked(await admin.from('user_roles').upsert({user_id:c.owner,role_id:role.id},{onConflict:'user_id,role_id',ignoreDuplicates:true}));}
   local=await admin.auth.admin.getUserById(c.owner);guard();
  }
  const user=local.data.user;
  if(!user?.email||user.id!==c.owner)throw Error('This web identity does not match the retained desktop account.');
  if(user.banned_until&&Date.parse(user.banned_until)>Date.now())throw Error('This desktop account is suspended.');
  const generated=checked(await admin.auth.admin.generateLink({type:'magiclink',email:user.email}));guard();
  if(generated.user?.id!==c.owner||!generated.properties?.hashed_token)throw Error('The internal sign-in belongs to another account.');
  const session=checked(await auth.auth.verifyOtp({type:'magiclink',token_hash:generated.properties.hashed_token})).session;issued=true;guard();
  if(!session||session.user.id!==c.owner)throw Error('The desktop session did not match your Sylvana account.');
  await secrets.setMany([...account.publication(c),['session',{access_token:session.access_token,refresh_token:session.refresh_token}]]);account.committed(c);guard();
  return session;
 }catch(error){if(issued)await auth.auth.signOut({scope:'local'}).catch(()=>{});throw error;}
 finally{persistence.resume();}
}
