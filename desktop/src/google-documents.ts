import {createHash,randomUUID} from 'node:crypto';
import {AjvJsonSchemaValidator} from '@modelcontextprotocol/client/validators/ajv';
import {composioRecord,type ComposioTool} from './composio-contracts';
import type {ComposioConnections,ComposioStore} from './composio-connections';
import {googleDocumentJournal,googleDocumentUrl,googleFileId,googleOfficeTypes,type GoogleOfficeExtension,type GoogleDocumentOperation,type GoogleDocumentResult,type GoogleDocumentAccounts} from './google-document-contracts';

export type GoogleDocumentInput={referenceId:string;relative:string;name:string;bytes:Uint8Array;check:()=>Promise<void>};
type Authority=Awaited<ReturnType<ComposioConnections['userConnection']>>;
const uploadTool='GOOGLEDRIVE_RESUMABLE_UPLOAD',findTool='GOOGLEDRIVE_FIND_FILE',metadataTool='GOOGLEDRIVE_GET_FILE_METADATA';
const heldNotice='Google has not confirmed this document yet. Check the existing upload before trying to create another copy.';
/** Only explicit UI file actions call this service. No model can supply paths, tool arguments or cloud identities. */
export class GoogleDocuments{
 private running=new Map<string,Promise<GoogleDocumentResult>>();
 private writes=new Map<string,Promise<unknown>>();
 private validator=new AjvJsonSchemaValidator();
 constructor(private store:ComposioStore,private connections:Pick<ComposioConnections,'status'|'userConnection'>,private owner: (owner:string)=>Promise<void>){}
 private key(owner:string){if(!/^[a-f0-9-]{36}$/i.test(owner))throw Error('Choose a valid account.');return 'google-documents:'+owner;}
 private read(owner:string){const value=this.store.get(this.key(owner));return value===undefined?{format:1 as const,operations:[]}:googleDocumentJournal(value);}
 private async write<T>(owner:string,change:(rows:GoogleDocumentOperation[])=>T){
  const prior=this.writes.get(owner)??Promise.resolve(),task=prior.catch(()=>{}).then(async()=>{await this.owner(owner);const journal=this.read(owner),result=change(journal.operations);await this.store.setMany([[this.key(owner),googleDocumentJournal(journal)]]);await this.owner(owner);return result;});this.writes.set(owner,task);try{return await task;}finally{if(this.writes.get(owner)===task)this.writes.delete(owner);}
 }
 private async phase(owner:string,id:string,phase:GoogleDocumentOperation['phase'],cloudId?:string){await this.write(owner,rows=>{const row=rows.find(row=>row.id===id);if(!row)throw Error('This saved Google upload is unavailable.');row.phase=phase;row.updatedAt=new Date().toISOString();if(cloudId)row.cloudId=cloudId;});}
 async accounts(owner:string):Promise<GoogleDocumentAccounts>{await this.owner(owner);const status=await this.connections.status(owner);await this.owner(owner);return {kind:'accounts',accounts:status.connections.filter(row=>row.enabled&&row.status==='ACTIVE'&&row.toolkit==='googledrive').map(row=>({id:row.id,name:row.name}))};}
 private capture(input:GoogleDocumentInput){
  const extension=/\.(docx|xlsx|pptx)$/i.exec(input.name)?.[0].toLowerCase() as GoogleOfficeExtension|undefined;
  if(!extension||!(input.bytes instanceof Uint8Array)||!input.bytes.byteLength||input.bytes.byteLength>20*1024*1024)throw Error('Google opening supports Word, Excel and PowerPoint files of up to 20 MB.');
  const bytes=Buffer.from(input.bytes),sha256=createHash('sha256').update(bytes).digest('hex');return {extension,bytes,sha256};
 }
 private async guard(owner:string,input:GoogleDocumentInput,authority:Authority,signal:AbortSignal){signal.throwIfAborted();await this.owner(owner);await input.check();await authority.guard();signal.throwIfAborted();}
 private async tool(authority:Authority,name:string,signal:AbortSignal){const tool=await authority.client.tool(name,'latest',signal);await authority.guard();if(tool.name!==name||tool.toolkit!=='googledrive')throw Error('Composio returned a different Google Drive action.');return tool;}
 private args(tool:ComposioTool,args:Record<string,unknown>){if(!this.validator.getValidator(tool.inputSchema)(args).valid)throw Error('The Google Drive action schema changed. Refresh the connection before continuing.');return args;}
 private async execute(owner:string,input:GoogleDocumentInput,authority:Authority,tool:ComposioTool,args:Record<string,unknown>,signal:AbortSignal){this.args(tool,args);await this.guard(owner,input,authority,signal);const value=await authority.client.execute(authority.connection.accountId,authority.user,tool.name,tool.version,args,signal);await this.guard(owner,input,authority,signal);return value;}
 private metadata(value:unknown,row:GoogleDocumentOperation){
  if(!composioRecord(value)||!googleFileId(value.id)||value.mimeType!==googleOfficeTypes[row.extension].target||value.trashed!==false||!composioRecord(value.appProperties)||value.appProperties.sylvana_operation!==row.id)throw Error('Google has not confirmed a matching, converted document. Check the existing upload again.');return value.id;
 }
 private async verify(owner:string,input:GoogleDocumentInput,authority:Authority,row:GoogleDocumentOperation,cloudId:string,signal:AbortSignal){
  const tool=await this.tool(authority,metadataTool,signal),result=await this.execute(owner,input,authority,tool,{fileId:cloudId,fields:'id,mimeType,appProperties,trashed'},signal);
  if(result.successful!==true)throw Error('The Google document is unavailable. Check its account and sharing permissions.');const id=this.metadata(result.data,row);if(id!==cloudId)throw Error('Google returned a different document.');return id;
 }
 private result(row:GoogleDocumentOperation,id:string,input:GoogleDocumentInput):GoogleDocumentResult{return {kind:'opened',operationId:row.id,url:googleDocumentUrl(row.extension,id),sourceChanged:createHash('sha256').update(input.bytes).digest('hex')!==row.sha256};}
 private async inspect(owner:string,input:GoogleDocumentInput,authority:Authority,row:GoogleDocumentOperation,signal:AbortSignal):Promise<GoogleDocumentResult>{
  const tool=await this.tool(authority,findTool,signal),result=await this.execute(owner,input,authority,tool,{q:"trashed = false and appProperties has { key='sylvana_operation' and value='"+row.id+"' }",fields:'files(id,mimeType,appProperties,trashed),nextPageToken,incompleteSearch',corpora:'user',pageSize:2},signal);
  if(result.successful!==true||!composioRecord(result.data)||!Array.isArray(result.data.files)||result.data.nextPageToken||result.data.incompleteSearch===true||result.data.files.length!==1)return {kind:'held',operationId:row.id,notice:heldNotice};
  const id=this.metadata(result.data.files[0],row);await this.verify(owner,input,authority,row,id,signal);await this.phase(owner,row.id,'completed',id);await this.guard(owner,input,authority,signal);return this.result(row,id,input);
 }
 async open(owner:string,input:GoogleDocumentInput,connectionId:string,signal:AbortSignal):Promise<GoogleDocumentResult>{
  await this.owner(owner);await input.check();const captured=this.capture(input),authority=await this.connections.userConnection(owner,connectionId,'googledrive',signal);await this.guard(owner,input,authority,signal);
  const matches=(row:GoogleDocumentOperation)=>row.binding===authority.binding&&row.referenceId===input.referenceId&&row.relative===input.relative&&row.sha256===captured.sha256;
  const runningKey=JSON.stringify([owner,authority.binding,input.referenceId,input.relative,captured.sha256]),running=this.running.get(runningKey);if(running){const result=await running;await this.guard(owner,input,authority,signal);return result;}
  const task=(async()=>{
   const operations=this.read(owner).operations,existing=operations.find(matches);
   const previousAccount=operations.find(row=>row.connectionId===authority.connection.id&&row.referenceId===input.referenceId&&row.relative===input.relative&&row.sha256===captured.sha256&&row.binding!==authority.binding&&['creating','held','completed'].includes(row.phase));
   if(!existing&&previousAccount)return {kind:'held' as const,operationId:previousAccount.id,notice:'This file has an upload recorded for the previous connected account. Check that connection and its upload before creating another Google copy.'};
   if(existing?.phase==='completed'){const id=await this.verify(owner,input,authority,existing,existing.cloudId!,signal);return this.result(existing,id,input);}
   if(existing&&['creating','held'].includes(existing.phase))return {kind:'held' as const,operationId:existing.id,notice:heldNotice};
   // Resolve all required tool schemas before sending file bytes. Unsupported schemas stop locally.
   const upload=await this.tool(authority,uploadTool,signal),find=await this.tool(authority,findTool,signal),meta=await this.tool(authority,metadataTool,signal),kind=googleOfficeTypes[captured.extension];
   this.args(upload,{file_to_upload:{name:input.name,mimetype:kind.source,s3key:'validation-only'},metadata:{name:input.name.replace(/\.[^.]+$/,''),mimeType:kind.target,appProperties:{sylvana_operation:existing?.id??randomUUID()}},chunkSize:262144,queryParams:{uploadType:'resumable'}});
   this.args(find,{q:"trashed = false and appProperties has { key='sylvana_operation' and value='validation-only' }",fields:'files(id,mimeType,appProperties,trashed),nextPageToken,incompleteSearch',corpora:'user',pageSize:2});this.args(meta,{fileId:'validation-only',fields:'id,mimeType,appProperties,trashed'});
   const now=new Date().toISOString(),row:GoogleDocumentOperation=existing??{id:randomUUID(),binding:authority.binding,connectionId:authority.connection.id,referenceId:input.referenceId,relative:input.relative,name:input.name,sha256:captured.sha256,bytes:captured.bytes.byteLength,extension:captured.extension,phase:'preparing',createdAt:now,updatedAt:now};
   await this.write(owner,rows=>{if(!existing){if(rows.length>=500)throw Error('The saved Google upload limit was reached. Preserve these records before starting another upload.');rows.push(row);}else{const saved=rows.find(value=>value.id===row.id)!;saved.phase='preparing';saved.updatedAt=now;}});
   let creating=false;
   try{
    const staged=await authority.client.uploadFile({name:input.name,mimetype:kind.source,bytes:captured.bytes,tool:uploadTool,toolkit:'googledrive'},()=>this.guard(owner,input,authority,signal),signal);
    const args=this.args(upload,{file_to_upload:staged,metadata:{name:input.name.replace(/\.[^.]+$/,''),mimeType:kind.target,appProperties:{sylvana_operation:row.id}},chunkSize:262144,queryParams:{uploadType:'resumable'}});
    await this.guard(owner,input,authority,signal);await this.phase(owner,row.id,'creating');creating=true;
    // The durable creation marker precedes this only cloud-creating request. Never retry it on an uncertain result.
    await this.execute(owner,input,authority,upload,args,signal);return await this.inspect(owner,input,authority,row,signal);
   }catch{await this.owner(owner);await this.phase(owner,row.id,creating?'held':'retryable');await this.guard(owner,input,authority,signal);return {kind:creating?'held' as const:'retryable' as const,operationId:row.id,notice:creating?heldNotice:'The file was not sent to Google Drive. Check the connection and retry this upload.'};}
  })();this.running.set(runningKey,task);try{return await task;}finally{if(this.running.get(runningKey)===task)this.running.delete(runningKey);}
 }
 async check(owner:string,input:GoogleDocumentInput,operationId:string,signal:AbortSignal):Promise<GoogleDocumentResult>{
  await this.owner(owner);await input.check();this.capture(input);const row=this.read(owner).operations.find(row=>row.id===operationId&&row.referenceId===input.referenceId&&row.relative===input.relative);if(!row)throw Error('This Google upload does not belong to the selected file.');
  const authority=await this.connections.userConnection(owner,row.connectionId,'googledrive',signal);await this.guard(owner,input,authority,signal);if(authority.binding!==row.binding)throw Error('The Google upload belongs to a different connection.');
  if(row.phase==='completed'){const id=await this.verify(owner,input,authority,row,row.cloudId!,signal);return this.result(row,id,input);}
  if(row.phase==='preparing'||row.phase==='retryable')return {kind:'retryable',operationId:row.id,notice:'No Google document creation was started. Retry the upload when the connection is available.'};
  try{return await this.inspect(owner,input,authority,row,signal);}catch{await this.guard(owner,input,authority,signal);return {kind:'held',operationId:row.id,notice:heldNotice};}
 }
}
