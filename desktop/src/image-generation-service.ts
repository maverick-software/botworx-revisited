import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ChatOptions,ChatEvent} from './contracts';
import type {ToolActivity,ToolApproval} from './tool-contracts';
import type {GeneratedImages,GeneratedImageScope} from './generated-images';
import type {WorkspaceFiles} from './workspace';
import type {Plugins} from './plugins';
import {ImageConnections} from './image-connections';
import {imageRoute} from './image-models';
import {generateImage,rasterImageType} from './image-generation-transport';
import {ImageGenerationError,imageGenerationArguments,imageGenerationTool,type ImageGenerationInput} from './image-generation-contracts';

const data=(result:any):any=>{if(result.error)throw new Error('The image operation could not be recorded. Inspect its saved activity before trying again.');return result.data;};
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
type ImageOperation={id:string;user_id:string;request_id:string;conversation_id:string;agent_id:string;native_thread_id:string;provider_call_id:string;connection:{provider:string;model:string};status:string};
type Execution={owner:string;agent:string;request:any;callId:string;nativeThreadId?:string;options:ChatOptions;signal:AbortSignal;guard:()=>Promise<void>;review:(id:string,approval:ToolApproval)=>Promise<boolean>};

export class ImageGenerationService{
 constructor(private db:SupabaseClient,readonly connections:ImageConnections,private registry:Pick<Plugins,'imageGeneration'>,private files:Pick<WorkspaceFiles,'preview'>,private images:Pick<GeneratedImages,'read'|'write'>,private ownerGuard:(owner:string)=>Promise<void>,private emit:(owner:string,event:ChatEvent)=>void,private thumbnail:(bytes:Buffer)=>string|undefined=()=>undefined,private fetcher:typeof fetch=fetch){}
 async definitions(owner:string,agent:string|undefined,options:ChatOptions){
  if(!agent||!['ask','full'].includes(options.permission)||options.mode==='plan'||!this.connections.configured(owner))return [];
  try{await this.registry.imageGeneration(owner,agent);return [imageGenerationTool];}catch{return [];}
 }
 private scope(operation:ImageOperation):GeneratedImageScope{return {id:operation.id,owner:operation.user_id,requestId:operation.request_id,conversationId:operation.conversation_id,nativeThreadId:operation.native_thread_id||null};}
 private async owned(owner:string,id:string,conversation?:string){
  await this.ownerGuard(owner);
  const operation=data(await this.db.from('desktop_image_generations').select('*').eq('user_id',owner).eq('id',id).single()) as ImageOperation;
  if(conversation&&operation.conversation_id!==conversation)throw new Error('This generated image belongs to a different chat.');
  const guard=async()=>{await this.ownerGuard(owner);data(await this.db.from('conversation_sessions').select('conversation_id').eq('user_id',owner).eq('conversation_id',operation.conversation_id).single());data(await this.db.from('desktop_image_generations').select('id').eq('user_id',owner).eq('id',id).eq('request_id',operation.request_id).single());};
  await guard();return {operation,guard};
 }
 async asset(owner:string,id:string,conversation?:string){const {operation,guard}=await this.owned(owner,id,conversation);if(operation.status!=='completed')throw new Error('This image has no confirmed saved result. Inspect its activity before creating another.');return this.images.read(this.scope(operation),guard);}
 async preview(owner:string,id:string){const value=await this.asset(owner,id);return {asset:value.asset,image:'data:image/png;base64,'+value.bytes.toString('base64')};}
 async recover(owner:string,id:string){
  const {operation,guard}=await this.owned(owner,id);
  if(operation.status==='completed')return this.preview(owner,id);
  if(!['dispatched','uncertain'].includes(operation.status))throw new Error('This image operation has no dispatched result to recover.');
  const request=data(await this.db.from('desktop_requests').select('status').eq('user_id',owner).eq('id',operation.request_id).single());
  if(request.status==='running')throw new Error('Wait for the current response to stop before inspecting a saved image.');
  const saved=await this.images.read(this.scope(operation),guard);await guard();
  const result={image:{...saved.asset,provider:operation.connection.provider,model:operation.connection.model,costUSD:null},recovered:true,message:'Recovered the previously stored image from this operation. No provider request was made. Its final cost was not recorded.'};
  const row=data(await this.db.rpc('desktop_transition_image_generation',{p_user:owner,p_id:id,p_expected:operation.status,p_status:'completed',p_result:result,p_error:null,p_approval:null}));
  this.emit(owner,{kind:'tool',requestId:operation.request_id,conversationId:operation.conversation_id,tool:{...row,native_call_id:operation.provider_call_id}});return {recovered:true};
 }
 async execute(value:unknown,execution:Execution){
  const {owner,agent,request,callId,nativeThreadId,options,signal}=execution,args=imageGenerationArguments(value);
  if(typeof callId!=='string'||!callId||callId.length>256)throw new Error('Image generation requires a stable tool-call identifier.');
  if(!['ask','full'].includes(options.permission)||options.mode==='plan')throw new Error('Image generation is disabled by this chat’s mode or permissions.');
  const connection=this.connections.connection(owner),fingerprint=this.connections.fingerprint(owner);
  const authorize=async()=>{signal.throwIfAborted();await execution.guard();await this.ownerGuard(owner);await this.registry.imageGeneration(owner,agent);if(!this.connections.configured(owner)||this.connections.fingerprint(owner)!==fingerprint)throw new Error('The image connection changed. Review a new request with its current settings.');};
  await authorize();
  const references:ImageGenerationInput['references']=[],checks:Array<()=>Promise<void>>=[];
  for(const reference of args.references){
   const load=async()=>{
    if(reference.kind==='generated')return (await this.asset(owner,reference.id,request.conversation_id)).bytes;
    if(!options.files.includes(reference.id))throw new Error('Choose an attached image from this chat’s selected context.');
    const value=await this.files.preview(owner,reference.id),match=value.image?.match(/^data:image\/(?:png|jpeg|webp);base64,(.+)$/s);if(!match)throw new Error('The selected attachment is not an available image.');return Buffer.from(match[1],'base64');
   };
   const bytes=await load(),digest=hash(bytes);references.push({bytes,mediaType:rasterImageType(bytes)});checks.push(async()=>{if(hash(await load())!==digest)throw new Error('A reference image changed after review.');});
  }
  const input={prompt:args.prompt,transparentBackground:args.transparent_background,references};
  const guard=async()=>{await authorize();for(const check of checks)await check();await authorize();};
  const route=await imageRoute(connection.provider,connection.model,input,AbortSignal.any([signal,AbortSignal.timeout(20000)]),this.fetcher);await guard();
  const argumentsHash=hash(JSON.stringify([args.prompt,args.transparent_background,args.references,references.map(reference=>hash(reference.bytes))]));
  const claim=data(await this.db.rpc('desktop_claim_image_generation',{p_user:owner,p_request:request.id,p_agent:agent,p_thread:nativeThreadId??'',p_call:callId,p_hash:argumentsHash,p_arguments:args,p_connection:{provider:connection.provider,model:connection.model,...(route.providerTag?{endpoint:route.providerTag}:{})}}));
  if(!claim.created)return claim.activity?.result?{...claim.activity.result,duplicate:true}:{error:claim.activity?.error??'This image operation was already attempted. Inspect its saved activity; do not repeat it.',duplicate:true};
  const operation=claim.operation as ImageOperation;let status='prepared',dispatched=false;
  const publish=(row:ToolActivity)=>this.emit(owner,{kind:'tool',requestId:request.id,conversationId:request.conversation_id,tool:{...row,...(options.permission==='full'&&row.status==='awaiting_approval'?{status:'running' as const}:{}),...(nativeThreadId?{native_call_id:callId}:{})}});publish(claim.activity);
  const transition=async(next:string,result:unknown=null,error:string|null=null,approval:ToolApproval|null=null)=>{const row=data(await this.db.rpc('desktop_transition_image_generation',{p_user:owner,p_id:operation.id,p_expected:status,p_status:next,p_result:result,p_error:error,p_approval:approval}));status=next;publish(row);return row;};
  try{
   const approval:ToolApproval={source:connection.provider==='openrouter'?'OpenRouter image connection':'OpenAI API image connection',tool:'Create image',description:'This uses the image plugin’s paid connection. The prompt and listed image references are shared with that provider after approval. The chat keeps its selected model. One image request will be sent; interrupted or uncertain requests are never automatically repeated.',arguments:{model:connection.model,...(route.providerTag?{endpoint:route.providerTag}:{}),prompt:args.prompt,transparent_background:args.transparent_background,references:args.references,pricing:route.pricing,cost:route.pricing.length?'Usage-based pricing; final cost is reported when available.':'Final cost is unavailable in advance. Check the provider’s current pricing.'}};
   // Register the pending decision before publishing it to the renderer.
   const approved=execution.review(operation.id,approval);approved.catch(()=>{});await transition('prepared',null,null,approval);
   if(!await approved){const result={denied:true,message:'The image request was declined. No image request was sent. Do not retry it.'};await transition('declined',result);return result;}
   await guard();
   const response=await generateImage(connection,input,{signal,route,fetch:this.fetcher,validate:guard,credential:async()=>this.connections.credential(owner,connection.provider)??'',dispatched:async()=>{await transition('dispatched');dispatched=true;}});
   const asset=await this.images.write(this.scope(operation),response.bytes,guard);
   const receipt={image:{...asset,provider:response.provider,model:response.model,costUSD:response.costUSD,...(response.providerRequestId?{providerRequestId:response.providerRequestId}:{})},message:'Image saved in this chat. Reference this generated image by its ID for a later edit.'};
   await transition('completed',receipt);
   const saved=await this.images.read(this.scope(operation),guard),thumbnail=this.thumbnail(saved.bytes);
   return {...receipt,...(thumbnail&&thumbnail.length<=2*1024*1024?{content:[{type:'image',mimeType:'image/png',data:thumbnail}]}:{})};
  }catch(error){
   if(status==='completed'){await this.ownerGuard(owner);if(signal.aborted)throw error;return data(await this.db.from('desktop_tool_calls').select('result').eq('user_id',owner).eq('id',operation.id).single()).result;}
   const outcome=error instanceof ImageGenerationError?error.outcome:dispatched?'uncertain':'before-dispatch',message=error instanceof ImageGenerationError?error.message:outcome==='uncertain'?'The image request has an uncertain saved result. Inspect this activity; do not automatically generate another image.':'The image request was not sent. Its connection, references or permission changed.';
   await transition(outcome==='uncertain'?'uncertain':'rejected',{error:message,outcome},message).catch(()=>{});
   if(signal.aborted)throw error;return {error:message,outcome};
  }
 }
}
