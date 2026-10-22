import type {NativeChildLocation,NativeChildView} from './native-contracts';
const id='[a-f0-9-]{36}';
export function childChatPath(conversationId:string,child:NativeChildLocation){return '/conversations/'+conversationId+'/subagents/'+child.requestId+'/'+child.threadId;}
export function parseChildChatPath(path:string):({conversationId:string;child:NativeChildLocation})|null{
 const match=new RegExp('^/conversations/('+id+')/subagents/('+id+')/('+id+')$','i').exec(path);
 return match?{conversationId:match[1],child:{requestId:match[2],threadId:match[3]}}:null;
}
export function mergeChildViews(previous:NativeChildView[],updates:NativeChildView[]){
 const key=(c:NativeChildView)=>c.requestId+':'+c.child.threadId,rows=new Map(previous.map(c=>[key(c),c]));
 for(const next of updates){const old=rows.get(key(next)),newer=old&&old.child.updatedAt>next.child.updatedAt?old:next;rows.set(key(next),{...newer,provider:next.provider||old?.provider||'',model:next.model||old?.model||''});}
 return [...rows.values()];
}
