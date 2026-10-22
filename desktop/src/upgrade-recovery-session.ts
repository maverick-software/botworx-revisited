import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import type {Secrets} from './secrets';
import {SessionPersistence} from './session-persistence';
import {WorkspaceFiles} from './workspace';
import {RestoredWorkspaces} from './restored-workspaces';
import {pendingWorkspaceUpgradeOwners} from './workspace-upgrade-pending';
import {nativeOutputDirectory} from './native-output-path';
import {scheduledWorkspaceDirectory} from './scheduled-workspaces';
import {storageUuid} from './storage-files';
import type {UpgradeRecoveryState} from './workspace-import-contracts';

type Client=Pick<SupabaseClient,'auth'>;
type Recovery=Pick<RestoredWorkspaces,'status'|'inspect'|'finish'|'copies'|'reveal'>;
type Options={env:Record<string,string>;profile:string;home:string;secrets:Secrets;privatePaths:string[];gitExecutable?:string;reveal:(folder:string)=>Promise<void>};
type Ports={auth:Client;admin:Client;recovery:Recovery;pending:(owners:string[],guard:()=>Promise<void>)=>Promise<string[]>};
const signedOut='Sign in to Agentopia to review workspace recovery.';
function need(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
function data<R extends {data?:unknown;error:unknown}>(result:R):R['data']{need(!result.error,'The local account service could not verify this sign-in. Retry when it is available.');return result.data;}

/** Deliberately independent of Broker: authentication and retained-file review
 * are available before migrations, without constructing any agent or queue. */
export class UpgradeRecoverySession{
 private ports:Ports;private persistence:SessionPersistence;private unsubscribe:()=>void;
 private closing=false;private sealed=false;private active?:Promise<unknown>;private epoch=0;
 constructor(private options:Options,ports?:Ports){
  const url=new URL(options.env.API_URL);need(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/','Upgrade recovery requires the local account service.');
  if(ports)this.ports=ports;else{
   const authOptions={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},auth=createClient(url.href,options.env.ANON_KEY,authOptions),admin=createClient(url.href,options.env.SERVICE_ROLE_KEY,authOptions),files=new WorkspaceFiles(options.secrets,undefined,[options.profile,...options.privatePaths]),workspaces=scheduledWorkspaceDirectory(options.profile,nativeOutputDirectory(options.profile,options.home));
   this.ports={auth,admin,recovery:new RestoredWorkspaces(options.profile,workspaces,options.secrets,files,options.gitExecutable),pending:(owners,guard)=>pendingWorkspaceUpgradeOwners({profile:options.profile,workspaces,owners,secrets:options.secrets,guard,signal:AbortSignal.timeout(15*60000)})};
  }
  this.persistence=new SessionPersistence(options.secrets);
  const subscription=this.ports.auth.auth.onAuthStateChange((event,session)=>this.persistence.capture(event,session));this.unsubscribe=()=>subscription.data.subscription.unsubscribe();
 }
 async initialize(){await this.persistence.restore(this.ports.auth.auth);}
 private available(){need(!this.closing&&!this.sealed,'The upgrade is continuing or Agentopia is closing. Wait for startup to finish.');}
 private run<T>(work:()=>Promise<T>):Promise<T>{
  this.available();need(!this.active,'Wait for the current recovery operation to finish.');
  const operation=Promise.resolve().then(work);this.active=operation;void operation.finally(()=>{if(this.active===operation)this.active=undefined;}).catch(()=>{});return operation;
 }
 private async current(){
  this.available();const epoch=this.epoch,auth=this.ports.auth.auth;
  const session=data(await auth.getSession()).session;if(!session)return null;
  if(session.expires_at&&session.expires_at*1000<Date.now()+60000)data(await auth.refreshSession());
  const user=data(await auth.getUser()).user;need(user&&storageUuid(user.id),'Your session expired. Sign in again.');
  const savedUser=data(await this.ports.admin.auth.admin.getUserById(user.id)).user;
  need(savedUser?.id===user.id,'This local account is no longer available.');need(!savedUser.banned_until||Date.parse(savedUser.banned_until)<=Date.now(),'This Agentopia account is suspended.');
  const saved=data(await auth.getSession()).session;this.available();need(this.epoch===epoch&&saved?.user.id===user.id,'Your recovery account changed. Sign in again.');
  return {id:user.id,email:user.email??''};
 }
 private async authenticated(){const account=await this.current();need(account,signedOut);return account;}
 private guard(owner:string){return async()=>{need((await this.authenticated()).id===owner,'Your recovery account changed.');};}
 private async pending(owner:string){
  const guard=this.guard(owner),owners:string[]=[];let finished=false;
  for(let page=1;page<=100;page++){
   await guard();const users=data(await this.ports.admin.auth.admin.listUsers({page,perPage:500})).users;
   need(Array.isArray(users)&&users.length<=500,'The local account list could not be verified.');
   for(const user of users){need(storageUuid(user.id)&&!owners.includes(user.id),'The local account list changed. Retry recovery review.');owners.push(user.id);}
   if(users.length<500){finished=true;break;}
  }
  need(finished&&owners.includes(owner),'The current local accounts could not be verified.');await guard();
  // Errors from a different owner's retained paths must not appear in this UI.
  try{return await this.ports.pending(owners,guard);}catch{throw Error('The saved workspace recovery metadata could not be verified. Preserve the profile and export diagnostics before continuing the upgrade.');}
 }
 private async state():Promise<UpgradeRecoveryState>{
  const account=await this.current();if(!account)return {account:null,canContinue:false,otherAccountPending:false};
  const pending=await this.pending(account.id),recovery=pending.includes(account.id)?await this.ports.recovery.status(account.id,account.email,this.guard(account.id)):undefined;
  need(!pending.includes(account.id)||recovery,'This account’s unfinished recovery could not be opened. Preserve the profile before continuing.');await this.guard(account.id)();
  return {account,recovery,canContinue:pending.length===0,otherAccountPending:pending.some(owner=>owner!==account.id)};
 }
 call(action:string,args:Record<string,unknown>={}){
  return this.run(async()=>{
   if(action==='recovery.upgrade.state')return this.state();
   if(action==='recovery.upgrade.signIn'){
    need(typeof args.email==='string'&&args.email.length<=254&&typeof args.password==='string'&&args.password.length>0&&args.password.length<=256,'Enter your local account email and password.');this.epoch++;
    data(await this.ports.auth.auth.signInWithPassword({email:args.email,password:args.password}));await this.authenticated();return;
   }
   if(action==='recovery.upgrade.signOut'){
    this.epoch++;this.persistence.suspend();try{data(await this.ports.auth.auth.signOut({scope:'local'}));await this.options.secrets.set('session',undefined);}finally{this.persistence.resume();}return;
   }
   need(action.startsWith('recovery.workspaces.'),'Finish workspace recovery before using chats, agents, schedules or tools.');
   const account=await this.authenticated();need(args.owner===account.id,'This workspace recovery belongs to another account.');const guard=this.guard(account.id);
   if(action==='recovery.workspaces.status')return this.ports.recovery.status(account.id,account.email,guard);
   if(action==='recovery.workspaces.inspect')return this.ports.recovery.inspect(account.id,guard);
   if(action==='recovery.workspaces.reveal'){
    need(typeof args.location==='string'&&(['staging','public','private'].includes(args.location)||/^attempt:[a-f0-9-]{36}$/.test(args.location)),'Choose a retained recovery folder.');return this.ports.recovery.reveal(account.id,args.location,guard,this.options.reveal);
   }
   if(action==='recovery.workspaces.finish'||action==='recovery.workspaces.copies'){
    need(storageUuid(args.inspection),'Inspect this account’s recovery first.');await this.ports.recovery[action==='recovery.workspaces.finish'?'finish':'copies'](account.id,args.inspection,guard);await guard();return {complete:true};
   }
   throw Error('Unsupported workspace recovery action.');
  });
 }
 beginUpgrade(){return this.run(async()=>{const account=await this.authenticated();need((await this.pending(account.id)).length===0,'Finish reviewing the remaining workspace recovery before continuing the upgrade.');await this.guard(account.id)();this.sealed=true;});}
 async shutdown(){this.closing=true;await this.active?.catch(()=>{});this.persistence.suspend();this.unsubscribe();}
}
