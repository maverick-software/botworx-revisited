import {readFileSync as read,writeFileSync as write} from 'node:fs';
const edit=(file,from,to)=>{const text=read(file,'utf8');if(!text.includes(from))throw Error(file+' missing '+from);write(file,text.replace(from,to));};
edit('desktop/src/agent-draft-previews.ts','sessionId?:string;sourceAgentId?:string;provider?', 'sessionId?:string;sourceAgentId?:string;creationId?:string;provider?');
edit('desktop/src/agent-draft-previews.ts','(!filter.sessionId||row.input.sessionId===filter.sessionId)&&', '(!filter.sessionId||row.input.sessionId===filter.sessionId)&&(!filter.creationId||row.input.creationId===filter.creationId)&&');
edit('desktop/src/preview-admissions.ts',"'sessionId'|'requestId'|'sourceAgentId'", "'sessionId'|'requestId'|'sourceAgentId'|'creationId'");
edit('desktop/src/preview-admissions.ts','(!filter.sessionId||row.input.sessionId===filter.sessionId)&&', '(!filter.sessionId||row.input.sessionId===filter.sessionId)&&(!filter.creationId||row.input.creationId===filter.creationId)&&');
edit('desktop/src/codex-draft-preview.ts','(!filter.sessionId||request.conversation_id===filter.sessionId)&&', '(!filter.sessionId||request.conversation_id===filter.sessionId)&&(!filter.creationId||request.preview_creation_id===filter.creationId)&&');
edit('desktop/src/broker.ts',"import {AgentEditorDrafts}","import {CreationToolResources} from './creation-tool-resources';\nimport {creationToolWrite} from './creation-tool-scope';\nimport {AgentEditorDrafts}");
edit('desktop/src/broker.ts',' readonly admin:SupabaseClient;', ' readonly admin:SupabaseClient;\n readonly creationTools:CreationToolResources;');
edit('desktop/src/broker.ts','this.admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,options);', 'this.admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,options);this.creationTools=new CreationToolResources(this.admin);');
edit('desktop/src/broker.ts','input&&(this.previewRemoteChanging(owner,input)||', "input&&(input.creationId&&this.changingPreviewScopes.has('creation-tools:'+owner+':'+input.creationId)||this.previewRemoteChanging(owner,input)||");
edit('desktop/src/broker.ts',"  if(action.startsWith('agentDraftPreview.'))return this.previewCall(user,action,args);",`  if(action.startsWith('agentDraftPreview.'))return this.previewCall(user,action,args);
  if(action.startsWith('creationTools.')){
   if(args.owner!==user.id)throw Error('This draft app selection belongs to another account.');const creation=uuid(action==='creationTools.write'?(args.input as any)?.creationId:args.creationId).toLowerCase();this.nativeControls++;
   const guard=async()=>{await this.attachmentOwner(user.id);if(this.closing||this.signedOut||this.currentOwner!==user.id||this.backingUp||this.scopeChanging)throw Error('Wait until your account and workspace are ready before changing draft apps.');};
   try{await guard();if(action==='creationTools.read'){const result=await this.creationTools.read(user.id,creation);await guard();return result;}
    if(action==='creationTools.catalog'){const registry=new Plugins(this.admin,()=>this.imageConnections.configured(user.id)),plugins=await registry.list(user);await guard();const scope=await this.creationTools.read(user.id,creation);await guard();return {scope,plugins:plugins.filter(row=>row.bundled||row.updatable).map(({name,version,description,digest,enabled,configured,kind})=>({name,version,description,digest,enabled,configured,kind}))};}
    if(action==='creationTools.write'){const input=creationToolWrite(args.input);return await this.mutatePreviewScope('creation-tools:'+user.id+':'+creation,{owner:user.id,creationId:creation},async()=>{await guard();const result=await this.creationTools.write(user.id,input);await guard();return result;});}
    throw Error('Unknown draft app operation.');
   }finally{this.nativeControls--;}
  }`);
edit('desktop/src/broker.ts',"const behavior=args.behavior===undefined?undefined:agentDraftBehavior(args.behavior);",`const behavior=args.behavior===undefined?undefined:agentDraftBehavior(args.behavior);
     if(args.creationToolRevision!==undefined&&(!creation||!Number.isSafeInteger(args.creationToolRevision)||Number(args.creationToolRevision)<1))throw Error('Choose an owned creation and its confirmed app selection revision.');
     const toolScope=creation?await this.creationTools.read(user.id,creation.id):null;await guard();if((toolScope?.revision)!==args.creationToolRevision)throw Error('The draft app selection changed. Refresh it before saving the agent.');
     if(toolScope&&!toolScope.boundAgentId)await this.creationTools.validate(user.id,toolScope.grants);await guard();`);
edit('desktop/src/broker.ts',"creation?(behavior?'desktop_create_agent_definition':'desktop_create_agent_presentation'):'desktop_save_agent'", "creation?(toolScope?'desktop_create_agent_with_tools':behavior?'desktop_create_agent_definition':'desktop_create_agent_presentation'):'desktop_save_agent'");
edit('desktop/src/broker.ts',"...(behavior?{p_behavior:behavior}:{})}:{...common,p_id:id}","...(toolScope?{p_tool_revision:toolScope.revision,p_behavior:behavior??null}:behavior?{p_behavior:behavior}:{})}:{...common,p_id:id}");
