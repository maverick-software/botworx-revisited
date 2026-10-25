import {readFileSync as read,writeFileSync as write} from 'node:fs';
const edit=(file,from,to)=>{const raw=read(file,'utf8');if(!raw.includes(from))throw Error(file+' missing '+from);write(file,raw.replace(from,to));};
let sql=read('desktop/database/0074-agent-draft-previews.sql','utf8');
sql=sql.slice(sql.indexOf('CREATE FUNCTION public.desktop_begin_agent_preview'),sql.indexOf('REVOKE ALL ON FUNCTION public.desktop_begin_agent_preview'));
sql=sql.replace('desktop_begin_agent_preview(', 'desktop_begin_scoped_preview(').replace('p_context jsonb DEFAULT NULL)', 'p_context jsonb DEFAULT NULL,p_creation uuid DEFAULT NULL)');
sql=sql.replace(' IF p_source IS NOT NULL AND NOT EXISTS', " IF p_creation IS NOT NULL AND p_source IS NOT NULL THEN RAISE EXCEPTION 'A new-agent preview cannot use a saved agent identity'; END IF;\n IF p_source IS NOT NULL AND NOT EXISTS");
sql=sql.replace('session.source_agent_id IS DISTINCT FROM p_source)', 'session.source_agent_id IS DISTINCT FROM p_source OR session.creation_id IS DISTINCT FROM p_creation)');
sql=sql.replace('request.execution_context IS DISTINCT FROM p_context THEN', 'request.execution_context IS DISTINCT FROM p_context OR request.creation_id IS DISTINCT FROM p_creation THEN');
sql=sql.replace('desktop_preview_sessions(id,user_id,source_agent_id) VALUES(p_session,p_user,p_source)', 'desktop_preview_sessions(id,user_id,source_agent_id,creation_id) VALUES(p_session,p_user,p_source,p_creation)');
sql=sql.replace('desktop_preview_requests(id,user_id,conversation_id,snapshot,input_text,execution_context) VALUES(p_request,p_user,p_session,p_snapshot,p_text,p_context)', 'desktop_preview_requests(id,user_id,conversation_id,snapshot,input_text,execution_context,creation_id) VALUES(p_request,p_user,p_session,p_snapshot,p_text,p_context,p_creation)');
write('desktop/database/0076-preview-creation-identity.sql',`-- Bind new-agent preview sessions to their immutable draft creation identity.
-- The complete 0074 acceptance validation is retained below. Existing unbound
-- sessions continue through the original API; they cannot adopt a creation ID.
ALTER TABLE public.desktop_preview_sessions ADD COLUMN creation_id uuid,
 ADD CONSTRAINT desktop_preview_creation_source CHECK(creation_id IS NULL OR source_agent_id IS NULL);
ALTER TABLE public.desktop_preview_requests ADD COLUMN creation_id uuid;
${sql}
REVOKE ALL ON FUNCTION public.desktop_begin_scoped_preview(uuid,uuid,uuid,uuid,jsonb,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_begin_scoped_preview(uuid,uuid,uuid,uuid,jsonb,text,jsonb,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.desktop_begin_agent_preview(p_user uuid,p_session uuid,p_request uuid,p_source uuid,p_snapshot jsonb,p_text text,p_context jsonb DEFAULT NULL) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.desktop_begin_scoped_preview(p_user,p_session,p_request,p_source,p_snapshot,p_text,p_context,NULL);
$$;
CREATE FUNCTION public.desktop_begin_creation_preview(p_user uuid,p_session uuid,p_request uuid,p_creation uuid,p_snapshot jsonb,p_text text,p_context jsonb DEFAULT NULL) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_creation IS NULL THEN RAISE EXCEPTION 'Choose a new-agent draft creation identity'; END IF;
 RETURN public.desktop_begin_scoped_preview(p_user,p_session,p_request,NULL,p_snapshot,p_text,p_context,p_creation);
END $$;
REVOKE ALL ON FUNCTION public.desktop_begin_creation_preview(uuid,uuid,uuid,uuid,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_begin_creation_preview(uuid,uuid,uuid,uuid,jsonb,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
`);
edit('desktop/src/agent-draft-preview-contracts.ts','sourceAgentId:string|null;text:string;snapshot:AgentDraftSnapshot','sourceAgentId:string|null;creationId?:string;text:string;snapshot:AgentDraftSnapshot');
edit('desktop/src/agent-draft-preview-contracts.ts','conversation_id:string;snapshot:AgentDraftSnapshot','conversation_id:string;creation_id?:string|null;snapshot:AgentDraftSnapshot');
edit('desktop/src/agent-draft-preview-contracts.ts',"['sessionId','requestId','sourceAgentId','text','snapshot']","['sessionId','requestId','sourceAgentId','creationId','text','snapshot']");
edit('desktop/src/agent-draft-preview-contracts.ts'," return {sessionId:draftPreviewId(v.sessionId),requestId:draftPreviewId(v.requestId),sourceAgentId:v.sourceAgentId==null?null:draftPreviewId(v.sourceAgentId),text:message,snapshot:agentDraftSnapshot(v.snapshot)};", " const source=v.sourceAgentId==null?null:draftPreviewId(v.sourceAgentId),creationId=v.creationId===undefined?undefined:draftPreviewId(v.creationId);if(source&&creationId)throw Error('A saved-agent preview cannot use a creation identity.');\n return {sessionId:draftPreviewId(v.sessionId),requestId:draftPreviewId(v.requestId),sourceAgentId:source,...(creationId?{creationId}:{}),text:message,snapshot:agentDraftSnapshot(v.snapshot)};");
edit('desktop/src/agent-draft-previews.ts',"this.db.rpc('desktop_begin_agent_preview',{p_user:owner,p_session:input.sessionId,p_request:input.requestId,p_source:input.sourceAgentId,p_snapshot:input.snapshot,p_text:input.text,p_context:context??null})", "this.db.rpc(input.creationId?'desktop_begin_creation_preview':'desktop_begin_agent_preview',{p_user:owner,p_session:input.sessionId,p_request:input.requestId,...(input.creationId?{p_creation:input.creationId}:{p_source:input.sourceAgentId}),p_snapshot:input.snapshot,p_text:input.text,p_context:context??null})");
edit('desktop/src/agent-editor-draft-contracts.ts','input.sourceAgentId!==expected)', 'input.sourceAgentId!==expected||input.creationId!==creationId)');
edit('desktop/ui/agent-preview-state.ts','pending.sourceAgentId!==source)', 'pending.sourceAgentId!==source||pending.creationId!==this.creationId)');
edit('desktop/ui/agent-preview-state.ts','sourceAgentId:this.source,text:this.view.prompt', 'sourceAgentId:this.source,...(this.creationId?{creationId:this.creationId}:{}),text:this.view.prompt');
edit('desktop/src/codex-draft-preview.ts','preview_source_agent_id:scope.sourceAgentId,', 'preview_source_agent_id:scope.sourceAgentId,preview_creation_id:request.creation_id??null,');
edit('desktop/src/codex-draft-preview.ts','previewDigest({snapshot,execution:', 'previewDigest({snapshot,creationId:request.creation_id??null,execution:');
