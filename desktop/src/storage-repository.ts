import type {SupabaseClient} from '@supabase/supabase-js';import {createHash} from 'node:crypto';
import type {StorageChat,StorageChild} from './storage-contracts';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value),'utf8');
const data=(result:any):any[]=>{if(result.error)throw Error(result.error.message);if(!Array.isArray(result.data))throw Error('Storage could not read the saved records.');return result.data;};
async function pages(query:()=>any,measure:(rows:any[])=>void){const result:any[]=[];for(let start=0;;start+=200){const rows=data(await query().range(start,start+199));measure(rows);result.push(...rows);if(result.length>100000)throw Error('This account has too many records for one storage review.');if(rows.length<200)return result;}}
export class StorageRepository{
 constructor(private db:SupabaseClient){}
 async read(owner:string):Promise<{chats:StorageChat[];children:StorageChild[]}>{
  let measured=0;const load=(query:()=>any)=>pages(query,rows=>{measured+=bytes(rows);if(measured>128*1024**2)throw Error('This account exceeds the 128 MB storage-inspection limit. Manage older conversations from history before trying again.');});
  const sessions=await load(()=>this.db.from('conversation_sessions').select('*').eq('user_id',owner).order('conversation_id'));
  const owned=new Map<string,{session:any;messages:any[];requests:any[];native:any[]}>(sessions.map(session=>[session.conversation_id,{session,messages:[],requests:[],native:[]}]));
  const ids=[...owned.keys()];for(let start=0;start<ids.length;start+=100){const batch=ids.slice(start,start+100);
   const messages=await load(()=>this.db.from('chat_messages_v2').select('*').in('conversation_id',batch).order('id'));
   for(const row of messages)owned.get(row.conversation_id)?.messages.push(row);
   const requests=await load(()=>this.db.from('desktop_requests').select('*').eq('user_id',owner).in('conversation_id',batch).order('id'));
   for(const row of requests)owned.get(row.conversation_id)?.requests.push(row);
   const requestIds=requests.map(row=>row.id);for(let offset=0;offset<requestIds.length;offset+=100){const natives=await load(()=>this.db.from('desktop_codex_turns').select('*').eq('user_id',owner).in('request_id',requestIds.slice(offset,offset+100)).order('request_id'));
    const requestChat=new Map(requests.map(row=>[row.id,row.conversation_id]));for(const row of natives)owned.get(requestChat.get(row.request_id)!)?.native.push(row);
   }
  }
  const children=new Map<string,{updated:string;value:StorageChild}>(),chats:StorageChat[]=[];
  for(const [id,row]of owned){let count=0;for(const native of row.native)for(const child of Array.isArray(native.state?.children)?native.state.children:[]){if(typeof child.threadId!=='string'||!child.threadId||child.threadId.length>200)continue;const key=id+':'+child.threadId,updated=native.updated_at??'';if(!children.has(key)||children.get(key)!.updated<updated)children.set(key,{updated,value:{id:hash(key),requestId:native.request_id,threadId:child.threadId,conversationId:id,name:typeof child.nickname==='string'?child.nickname.slice(0,200):typeof child.name==='string'?child.name.slice(0,200):'Subagent',status:typeof child.status==='string'?child.status:'saved',bytes:bytes(child)}});}
   count=[...children.values()].filter(child=>child.value.conversationId===id).length;
   const snapshot={session:row.session,messages:row.messages,requests:row.requests,native:row.native};chats.push({id,title:row.session.title||'Untitled chat',archived:row.session.session_state?.desktop_archived===true,pinned:row.session.session_state?.desktop_pinned===true,updatedAt:row.session.last_active??row.session.started_at??'',messages:row.messages.length,requests:row.requests.length,children:count,bytes:bytes(snapshot),fingerprint:hash(snapshot)});
  }
  return {chats,children:[...children.values()].map(row=>row.value)};
 }
}
