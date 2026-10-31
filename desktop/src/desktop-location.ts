import type {SupabaseClient} from '@supabase/supabase-js';
import type {Secrets} from './secrets';
import type {DesktopLocation} from './contracts';
const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
export function desktopLocation(value:unknown):DesktopLocation{
 const input=value as DesktopLocation;if(!input||!['chat','agents','plugins','skills','tools','scheduled'].includes(input.view))throw new Error('Invalid desktop location.');
 const result:DesktopLocation={view:input.view==='tools'?'plugins':input.view};for(const key of ['conversationId','agentId','projectId'] as const)if(input[key]!==undefined&&input[key]!==null){if(!uuid(input[key]))throw new Error('Invalid desktop location identifier.');result[key]=input[key];}
 if(input.child!==undefined){if(input.view!=='chat'||!result.conversationId||!uuid(input.child?.requestId)||!uuid(input.child?.threadId))throw new Error('Invalid subagent chat location.');result.child={requestId:input.child.requestId,threadId:input.child.threadId};}return result;
}
export class DesktopLocations{
 constructor(private db:SupabaseClient,private secrets:Secrets){}
 private async owned(user:string,input:DesktopLocation,strict:boolean){
  const result={...input},fields=[['conversationId','conversation_sessions','conversation_id'],['agentId','agents','id'],['projectId','desktop_projects','id']] as const;
  await Promise.all(fields.map(async([key,table,column])=>{if(!result[key])return;const response=await this.db.from(table).select(column).eq(column,result[key]!).eq('user_id',user).maybeSingle();if(response.error)throw new Error(response.error.message);if(!response.data){if(strict)throw new Error('This desktop location is unavailable for your account.');delete result[key];}}));
  if(result.child){const response=await this.db.from('desktop_codex_turns').select('state,desktop_requests!inner(conversation_id)').eq('request_id',result.child.requestId).eq('user_id',user).maybeSingle();if(response.error)throw new Error(response.error.message);const row=response.data as any;if(!result.conversationId||row?.desktop_requests?.conversation_id!==result.conversationId||!row?.state?.children?.some((c:any)=>c.threadId===result.child!.threadId)){if(strict)throw new Error('This subagent chat is unavailable for your account.');delete result.child;}}
  return result;
 }
 async call(action:string,args:Record<string,unknown>,user:string,guard:()=>Promise<void>){
  if(args.owner!==user)throw new Error('This desktop location belongs to another account.');await guard();
  const key='desktop-location:'+user;
  if(action==='navigation.state'){const saved=this.secrets.get<DesktopLocation>(key);if(!saved)return null;let value:DesktopLocation;try{value=desktopLocation(saved);}catch{return null;}const result=await this.owned(user,value,false);await guard();return result;}
  if(action==='navigation.save'){const value=await this.owned(user,desktopLocation(args.state),true);await guard();await this.secrets.set(key,value);return value;}
  throw new Error('Unsupported desktop navigation operation.');
 }
}
