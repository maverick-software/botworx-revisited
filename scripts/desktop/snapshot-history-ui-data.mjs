import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const state=JSON.parse(execFileSync('wsl.exe',['-d','AgentopiaRuntime','-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stack','status','--output-format','json'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}));
const db=createClient(state.env.API_URL,state.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const snapshot={};
for(const [table,order,select] of [['chat_messages_v2','id','id,conversation_id,role,content,metadata'],['conversation_sessions','conversation_id','conversation_id,user_id,agent_id,title'],['desktop_projects','id','*'],['user_roles','user_id','*']]){
 const all=[];for(let i=0;;i+=500){const rows=check(await db.from(table).select(select).order(order).range(i,i+499));all.push(...rows);if(rows.length<500)break;}snapshot[table]={count:all.length,sha256:hash(all)};
}
const users=check(await db.auth.admin.listUsers({perPage:1000})).users.map(u=>({id:u.id,email:u.email})).sort((a,b)=>a.id.localeCompare(b.id));snapshot.accounts={count:users.length,sha256:hash(users)};
const requests=check(await db.from('desktop_requests').select('status').in('status',['running','pending','queued']));snapshot.activeRequests=requests.length;
const out=path.resolve(import.meta.dirname,'../..',process.env.AGENTOPIA_HISTORY_OUTPUT??'.supabase/desktop-history-refinement');await mkdir(out,{recursive:true});const file=path.join(out,'data-before.json');
if(process.argv.includes('--after')){const prior=JSON.parse(await readFile(file,'utf8'));assert.deepEqual(snapshot,prior);await writeFile(path.join(out,'data-after.json'),JSON.stringify(snapshot,null,2));console.log('PASS original accounts, roles, projects, conversation titles and message contents match the pre-update snapshot.');}
else{assert.equal(requests.length,0,'Finish active chats before refreshing the installed interface.');await writeFile(file,JSON.stringify(snapshot,null,2));console.log('Saved database snapshot hashes; no active chat requests.');}
