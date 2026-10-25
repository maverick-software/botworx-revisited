import {readFileSync as read,writeFileSync as write} from 'node:fs';
const edit=(file,from,to)=>{const text=read(file,'utf8');if(!text.includes(from))throw Error(file+' missing '+from);write(file,text.replace(from,to));};
edit('scripts/desktop/agent-preview-ui-fixture.ts'," const key='fixture.preview.backend76'",` const creationKey='fixture.creation-tools115.'+owner,creationScopes=()=>JSON.parse(localStorage.getItem(creationKey)??'{}'),saveCreation=(rows:any)=>localStorage.setItem(creationKey,JSON.stringify(rows));
 const bindCreation=(creationId:string,agentId:string)=>{const rows=creationScopes(),scope=rows[creationId];if(scope){scope.boundAgentId=agentId;scope.boundRevision=scope.revision;saveCreation(rows);}};
 const key='fixture.preview.backend76'`);
edit('scripts/desktop/agent-preview-ui-fixture.ts',' return {onChat:', ' return {bindCreation,onChat:');
edit('scripts/desktop/agent-preview-ui-fixture.ts',"action.startsWith('agentDraftPreview.')||", "action.startsWith('creationTools.')||action.startsWith('agentDraftPreview.')||");
edit('scripts/desktop/agent-preview-ui-fixture.ts',"  if(action==='editorDrafts.list')",`  if(action==='creationTools.catalog')return {scope:creationScopes()[args.creationId]??null,plugins:JSON.parse(localStorage.getItem('fixture.creation-plugins115')??'[]')};
  if(action==='creationTools.read')return creationScopes()[args.creationId]??null;
  if(action==='creationTools.write'){const input=args.input,rows=creationScopes(),old=rows[input.creationId];if(localStorage.getItem('fixture.creation-app-fail115'))throw Error('Controlled app selection failure');if(old?.writeId===input.writeId)return old;if(old?.boundAgentId)throw Error('Created scope is closed');if((old?.revision??0)!==input.expectedRevision)throw Error('Selection changed');const scope={version:1,id:old?.id??crypto.randomUUID(),owner,creationId:input.creationId,revision:input.expectedRevision+1,writeId:input.writeId,grants:[...input.grants].sort((a:any,b:any)=>a.name<b.name?-1:1),boundAgentId:null,boundRevision:null};rows[input.creationId]=scope;saveCreation(rows);return scope;}
  if(action==='editorDrafts.list')`);
edit('scripts/desktop/agent-creation75-fixture.tsx',"if(replyFail)throw Error('Controlled lost creation reply');", "previewFixture.bindCreation(args.creationId,id);if(replyFail)throw Error('Controlled lost creation reply');");
edit('scripts/desktop/test-agent-creation75-app.mjs'," if(action==='agents.list')", " if(action==='creationTools.catalog')return {scope:null,plugins:[]};\n if(action==='agents.list')");
