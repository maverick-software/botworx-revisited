import {createHash} from 'node:crypto';
import {mkdir,open,writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {SylvanaAccount} from './sylvana-account';
import type {ToolDefinition} from './tool-contracts';
import type {ChatOptions} from './contracts';
import type {WorkspaceFiles} from './workspace';
export const sylvanaServiceTools=['sylvana_models','sylvana_generate','sylvana_operation'];
const kinds=['audio/speech','audio/transcriptions','videos','embeddings','rerank'];
const object=(properties:Record<string,unknown>,required:string[])=>({type:'object',properties,required,additionalProperties:false});
export function serviceOperationId(owner:string,request:string,call:string){const h=createHash('sha256').update(JSON.stringify([owner,request,call])).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);}
export class SylvanaServices{
 constructor(private account:SylvanaAccount,private directory:string,private files:Pick<WorkspaceFiles,'list'>){}
 definitions(owner:string,options:ChatOptions):ToolDefinition[]{
  const s=this.account.status(owner);if(!s.linked||s.simulated||!['ask','full'].includes(options.permission))return [];
  return [
   {name:'sylvana_models',namespace:'tools',description:'Discover Sylvana models and supported parameters for speech, transcription, video, embeddings and reranking under the current firm policy.',parameters:object({capability:{type:'string',enum:kinds}},['capability']),annotations:{readOnlyHint:true,idempotentHint:true}},
   {name:'sylvana_generate',namespace:'tools',description:'Run one paid Sylvana speech, transcription, video, embedding or reranking request. Discover a model first. parameters_json contains the model parameters; it cannot change routing or retention policy. audio_attachment_id may name one selected audio attachment. Output stays local. Video returns an operation ID; inspect that operation instead of submitting again. Never retry an uncertain generation.',parameters:object({capability:{type:'string',enum:kinds},model:{type:'string'},parameters_json:{type:'string'},audio_attachment_id:{type:['string','null']}},['capability','model','parameters_json','audio_attachment_id']),annotations:{readOnlyHint:false,idempotentHint:false,openWorldHint:true}},
   {name:'sylvana_operation',namespace:'tools',description:'Inspect a previously submitted Sylvana operation. Set download=true to save its ready media output in the local profile. This does not generate another output.',parameters:object({operation_id:{type:'string'},download:{type:'boolean'}},['operation_id','download']),annotations:{readOnlyHint:true,idempotentHint:true}},
  ];
 }
 private async json(response:Response){if(!response.ok){await response.body?.cancel();throw Error('Sylvana could not complete this operation. Inspect its usage and status before retrying.');}const data=await this.bytes(response,64*1024*1024);return JSON.parse(data.toString('utf8'));}
 private async bytes(response:Response,limit=128*1024*1024){if(!response.body)throw Error('The service returned no output.');const chunks:Buffer[]=[];let total=0;for await(const chunk of response.body as any){total+=chunk.length;if(total>limit){await response.body.cancel().catch(()=>{});throw Error('The generated output exceeds the local import limit.');}chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);}
 private async save(owner:string,operation:string,response:Response,guard:()=>Promise<void>){
  if(!response.ok){await response.body?.cancel();throw Error('The generated output is unavailable.');}
  const mime=response.headers.get('content-type')?.split(';')[0],extension=({'audio/mpeg':'.mp3','audio/mp3':'.mp3','audio/wav':'.wav','audio/pcm':'.pcm','audio/L16':'.pcm','video/mp4':'.mp4','video/webm':'.webm','application/json':'.json'} as Record<string,string>)[mime??''];
  if(!extension){await response.body?.cancel();throw Error('The media format is unsupported.');}
  const bytes=await this.bytes(response);await guard();const folder=path.join(this.directory,owner,operation);await mkdir(folder,{recursive:true,mode:0o700});const file=path.join(folder,'output'+extension);try{await writeFile(file,bytes,{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}return {operation_id:operation,path:file,bytes:bytes.length,media_type:mime,message:'Generated output saved in this account’s local profile.'};
 }
 async execute(owner:string,request:string,call:string,name:string,args:any,options:ChatOptions,signal:AbortSignal,guard:()=>Promise<void>){
  await guard();await this.account.verifySession(owner,true);signal.throwIfAborted();
  if(!['ask','full'].includes(options.permission))throw Error('This chat does not permit managed tools.');
  if(name==='sylvana_models'){
   if(!kinds.includes(args.capability))throw Error('Choose a supported capability.');const catalog=await this.json(await this.account.providerRequest(owner,'/v1/models',{signal}));return {models:catalog.data.filter((m:any)=>m.capabilities?.includes(args.capability))};
  }
  if(name==='sylvana_operation'){
   if(!/^[a-f0-9-]{36}$/.test(args.operation_id)||typeof args.download!=='boolean')throw Error('Choose an operation ID.');
   const status=await this.json(await this.account.providerRequest(owner,'/v1/operations/'+args.operation_id,{signal}));
   if(!args.download||!status.content)return status;
   return this.save(owner,args.operation_id,await this.account.providerRequest(owner,'/v1/operations/'+args.operation_id+'/content',{signal}),guard);
  }
  if(name!=='sylvana_generate'||options.mode==='plan'||!kinds.includes(args.capability)||typeof args.model!=='string'||typeof args.parameters_json!=='string'||args.parameters_json.length>1024*1024)throw Error('Choose a supported managed generation.');
  const parameters=JSON.parse(args.parameters_json);if(!parameters||typeof parameters!=='object'||Array.isArray(parameters)||['provider','model','callback_url','store','stream'].some(k=>k in parameters))throw Error('Supply model parameters without service routing overrides.');
  if(args.audio_attachment_id){
   if(args.capability!=='audio/transcriptions'||!options.files.includes(args.audio_attachment_id))throw Error('Choose an audio attachment selected in this chat.');
   const reference=this.files.list(owner).find(f=>f.id===args.audio_attachment_id&&f.kind==='file');if(!reference)throw Error('The selected audio attachment is unavailable.');
   const format=path.extname(reference.path).slice(1).toLowerCase();if(!['wav','mp3','flac','m4a','ogg','webm','aac','opus'].includes(format))throw Error('Choose a supported audio file.');
   const file=await open(reference.path,'r');try{const stat=await file.stat();if(!stat.isFile()||stat.size>25*1024*1024)throw Error('Audio must be a file of at most 25 MiB.');parameters.input_audio={data:(await file.readFile()).toString('base64'),format};}finally{await file.close();}
  }
  const operation=serviceOperationId(owner,request,call);await guard();signal.throwIfAborted();
  const response=await this.account.providerRequest(owner,'/v1/'+args.capability,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':operation},body:JSON.stringify({...parameters,model:args.model}),signal});
  if(response.headers.get('content-type')?.startsWith('audio/'))return this.save(owner,operation,response,guard);
  const value=await this.json(response);await guard();
  if(args.capability==='videos')return value;
  const serialized=JSON.stringify(value);if(serialized.length<32000)return value;
  return this.save(owner,operation,new Response(serialized,{headers:{'Content-Type':'application/json'}}),guard);
 }
}
