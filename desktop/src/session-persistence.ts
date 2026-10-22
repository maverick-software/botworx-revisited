import type {Secrets} from './secrets';

type Tokens={access_token:string;refresh_token:string};
type SessionClient={setSession:(tokens:Tokens)=>Promise<{data?:{session?:Tokens|null}|null;error?:unknown}>};
const rejectedCodes=new Set(['refresh_token_already_used','refresh_token_not_found','session_not_found','session_expired','user_not_found','bad_jwt']);

// The auth client awaits this handler before completing a token rotation. Keep
// SDK calls out of the handler: re-entering the auth client can deadlock it.
export class SessionPersistence {
 private accepting=true;
 constructor(private secrets:Pick<Secrets,'get'|'set'>){}
 suspend(){this.accepting=false;}
 resume(){this.accepting=true;}
 async capture(event:string,session:Tokens|null){
  if(!this.accepting||!['SIGNED_IN','TOKEN_REFRESHED'].includes(event)||!session)return;
  if(typeof session.access_token!=='string'||typeof session.refresh_token!=='string')throw new Error('The saved sign-in credential is invalid. Sign in again.');
  try{await this.secrets.set('session',{access_token:session.access_token,refresh_token:session.refresh_token});}
  catch{throw new Error('Agentopia could not save your sign-in securely. Check access to its application data folder before continuing.');}
 }
 async restore(auth:SessionClient){
  const saved=this.secrets.get<Tokens>('session');if(!saved)return false;
  let result:Awaited<ReturnType<SessionClient['setSession']>>;
  try{result=await auth.setSession(saved);}catch{throw new Error('Agentopia could not restore your saved sign-in. Retry startup when the local account service is available.');}
  if(result.error){
   const error=result.error as {code?:string;status?:number};
   if(error.status!==undefined&&error.status>=400&&error.status<500&&error.code&&rejectedCodes.has(error.code)){
    const current=this.secrets.get<Tokens>('session');
    if(current?.access_token===saved.access_token&&current?.refresh_token===saved.refresh_token)await this.secrets.set('session',undefined);
    return false;
   }
   throw new Error('Agentopia could not restore your saved sign-in. Retry startup when the local account service is available.');
  }
  if(!result.data?.session)throw new Error('Agentopia could not restore your saved sign-in. Retry startup when the local account service is available.');
  await this.capture('SIGNED_IN',result.data.session);
  return true;
 }
}
