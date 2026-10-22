import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync,existsSync,unlinkSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const prefix=['--distribution','AgentopiaRuntime','--user','agentopia','--cd','/home/agentopia/app','--exec'];
try{execFileSync('wsl.exe',[...prefix,'supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio'],{windowsHide:true,stdio:'pipe'});}catch{throw new Error('The native upgrade verification runtime could not start.');}
const state=JSON.parse(execFileSync('wsl.exe',[...prefix,'supabase','stack','status','--output-format','json'],{encoding:'utf8',windowsHide:true}));
assert.equal(state.runtime,'native');
const service=createClient(state.env.API_URL,state.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
function check(result){if(result.error)throw new Error(result.error.message);return result.data;}
const file=new URL('../../.supabase/desktop-poc/upgrade-fixture.json',import.meta.url);
if(process.argv[2]==='create'){
 if(existsSync(file)){const old=JSON.parse(readFileSync(file,'utf8')),result=await service.auth.admin.getUserById(old.userId);if(result.data?.user)throw new Error('An upgrade fixture is still pending. Verify it before creating another.');if(result.error&&result.error.status!==404)throw new Error('Could not verify the previous upgrade fixture.');unlinkSync(file);}
 const user=check(await service.auth.admin.createUser({email:`upgrade-proof-${randomUUID()}@example.com`,password:randomBytes(24).toString('base64url')+'Aa1!',email_confirm:true})).user;
 const agent=check(await service.rpc('desktop_save_agent',{p_user:user.id,p_id:null,p_name:'Installer upgrade proof',p_description:'Disposable upgrade fixture',p_instructions:'Preserve these instructions',p_provider:'openrouter',p_model:'fixture/upgrade'}));
 const request=check(await service.rpc('desktop_begin_chat',{p_user:user.id,p_request:randomUUID(),p_agent:agent,p_conversation:null,p_text:'Upgrade persistence check'}));
 check(await service.rpc('desktop_checkpoint_chat',{p_user:user.id,p_request:request.id,p_text:'Preserved across installer upgrade',p_status:'completed',p_error:null}));
 const projectFile=randomUUID(),project=check(await service.from('desktop_projects').insert({user_id:user.id,name:'Upgrade workspace project',instructions:'Retain project instructions across upgrade',file_ids:[projectFile]}).select('id').single());
 check(await service.from('desktop_project_chats').insert({user_id:user.id,project_id:project.id,conversation_id:request.conversation_id}));
 const connection=randomUUID(),token=randomBytes(32).toString('base64url');
 check(await service.rpc('desktop_save_mcp_connection',{p_user:user.id,p_id:connection,p_agent:agent,p_name:'Upgrade MCP fixture',p_url:'https://fixture.example.invalid/mcp',p_token:token}));
 writeFileSync(file,JSON.stringify({userId:user.id,agentId:agent,conversationId:request.conversation_id,requestId:request.id,projectId:project.id,projectFile,mcpId:connection,mcpTokenDigest:createHash('sha256').update(token).digest('hex')}),{mode:0o600});
 console.log('Created disposable account, agent, and completed conversation before the installer upgrade.');
}else if(process.argv[2]==='verify'){
 const fixture=JSON.parse(readFileSync(file,'utf8'));
 assert(check(await service.auth.admin.getUserById(fixture.userId)).user);
 assert.equal(check(await service.from('agents').select('system_instructions').eq('id',fixture.agentId).single()).system_instructions,'Preserve these instructions');
 const messages=check(await service.from('chat_messages_v2').select('content,metadata').eq('conversation_id',fixture.conversationId).order('desktop_sequence'));
 assert.equal(messages.length,2);assert.equal(messages[1].content.text,'Preserved across installer upgrade');assert.equal(messages[1].metadata.status,'completed');
 assert.equal(check(await service.from('desktop_requests').select('status').eq('id',fixture.requestId).single()).status,'completed');
 if(fixture.projectId){const project=check(await service.from('desktop_projects').select('name,instructions,file_ids,revision').eq('id',fixture.projectId).single());assert.equal(project.name,'Upgrade workspace project');if(fixture.projectFile){assert.equal(project.instructions,'Retain project instructions across upgrade');assert.deepEqual(project.file_ids,[fixture.projectFile]);assert.equal(project.revision,1);}assert.equal(check(await service.from('desktop_project_chats').select('project_id').eq('conversation_id',fixture.conversationId).single()).project_id,fixture.projectId);}
 if(fixture.mcpId){const connection=check(await service.from('agent_mcp_connections').select('auth_config').eq('id',fixture.mcpId).single()),secret=check(await service.rpc('get_secret',{secret_id:connection.auth_config.desktop_token_id}))[0]?.key;if(typeof secret!=='string'||createHash('sha256').update(secret).digest('hex')!==fixture.mcpTokenDigest)throw new Error('The protected MCP credential was not retained across the installer upgrade.');}
 check(await service.from('agents').delete().eq('id',fixture.agentId));check(await service.auth.admin.deleteUser(fixture.userId));
 unlinkSync(file);
 console.log('PASS: The actual installer upgrade retained the account, project, protected MCP credential, agent instructions, conversation, response lifecycle, and message order. Removed the disposable upgrade fixture.');
}else throw new Error('Choose create or verify.');
