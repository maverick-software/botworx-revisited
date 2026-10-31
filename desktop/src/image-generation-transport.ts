import {createHash} from 'node:crypto';
import {ImageGenerationError,imageConnection,maxGeneratedImageBytes,type ImageConnection,type ImageGenerationInput,type ImageGenerationResult,type RasterImageType} from './image-generation-contracts';
import type {ImageRoute} from './image-models';

const maxResponseBytes=Math.ceil(maxGeneratedImageBytes/3)*4+1024*1024;
const safeCode=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_.-]{1,200}$/.test(value)?value:undefined;
export function rasterImageType(bytes:Buffer):RasterImageType{
 if(bytes.length<12||bytes.length>maxGeneratedImageBytes)throw new Error('The image is empty or exceeds 32 MiB.');
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 throw new Error('The provider must return a PNG, JPEG or WebP image. Remote URLs, SVG and executable content are not imported.');
}
function prepared(connection:ImageConnection,input:ImageGenerationInput,route?:ImageRoute){
 if(!connection.enabled)throw new Error('Enable and configure the image-generation plugin before generating images.');
 if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>32000||typeof input.transparentBackground!=='boolean'||!Array.isArray(input.references)||input.references.length>5)throw new Error('Enter a prompt of up to 32,000 characters and at most five authorized reference images.');
 let bytes=0;for(const reference of input.references){if(!Buffer.isBuffer(reference.bytes)||rasterImageType(reference.bytes)!==reference.mediaType)throw new Error('A reference image does not match its declared format.');bytes+=reference.bytes.length;}if(bytes>maxGeneratedImageBytes)throw new Error('Reference images exceed 32 MiB combined.');
 const base={model:connection.model,prompt:input.prompt,n:1,background:input.transparentBackground?'transparent':'opaque',output_format:'png'};
 if(connection.provider==='sylvana')return {url:'https://sylvana.invalid/v1/images',body:JSON.stringify({model:connection.model,prompt:input.prompt,n:1,...route?.parameters,...(input.references.length?{input_references:input.references.map(reference=>({type:'image_url',image_url:{url:'data:'+reference.mediaType+';base64,'+reference.bytes.toString('base64')}}))}:{})}),json:true};
 if(connection.provider==='openrouter')return {url:'https://openrouter.ai/api/v1/images',body:JSON.stringify({...route?{model:connection.model,prompt:input.prompt,...route.parameters}:base,provider:{allow_fallbacks:false,...(route?.providerTag?{only:[route.providerTag]}:{})},...(input.references.length?{input_references:input.references.map(reference=>({type:'image_url',image_url:{url:'data:'+reference.mediaType+';base64,'+reference.bytes.toString('base64')}}))}:{})}),json:true};
 if(!input.references.length)return {url:'https://api.openai.com/v1/images/generations',body:JSON.stringify(base),json:true};
 const body=new FormData();for(const [key,value]of Object.entries(base))body.append(key,String(value));for(const [index,reference]of input.references.entries())body.append('image[]',new Blob([new Uint8Array(reference.bytes)],{type:reference.mediaType}),'reference-'+(index+1)+({"image/png":'.png',"image/jpeg":'.jpg',"image/webp":'.webp'}[reference.mediaType]));
 return {url:'https://api.openai.com/v1/images/edits',body,json:false};
}
async function boundedJson(response:Response){
 if(!response.body)throw new Error('The provider returned no image response.');
 const reader=response.body.getReader(),chunks:Buffer[]=[];let size=0;
 try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>maxResponseBytes){await reader.cancel();throw new Error('The provider image response exceeds the supported limit.');}chunks.push(Buffer.from(next.value));}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 finally{reader.releaseLock();}
}
/** One dispatch only. Durable operation identity and current authorization are supplied by the host. */
export async function generateImage(connectionValue:unknown,input:ImageGenerationInput,context:{signal:AbortSignal;credential:()=>Promise<string>;validate:()=>Promise<void>;dispatched:()=>Promise<void>;fetch?:typeof fetch;route?:ImageRoute}):Promise<ImageGenerationResult>{
 let dispatched=false;
 try{
  const connection=imageConnection(connectionValue),request=prepared(connection,input,context.route);context.signal.throwIfAborted();await context.validate();context.signal.throwIfAborted();
  const token=await context.credential();if(typeof token!=='string'||!token||token.length>16384||/[\r\n]/.test(token))throw new Error('The configured image credential is unavailable.');
  await context.validate();context.signal.throwIfAborted();await context.dispatched();dispatched=true;context.signal.throwIfAborted();
  const response=await (context.fetch??fetch)(request.url,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,...(request.json?{'Content-Type':'application/json'}:{}),'User-Agent':'Sylvana image-generation'},body:request.body,signal:context.signal});
  if(!response.ok){
   let value:any;try{value=await boundedJson(response);}catch{await response.body?.cancel().catch(()=>{});}
   const messages:Record<number,string>={400:'The selected image model does not accept this request.',401:'The image connection is not authorized. Check its own credential.',402:'The image connection needs credits.',403:'The image connection does not allow this model or capability.',404:'The selected image model or endpoint is unavailable.',429:'The image connection reached a usage limit. Wait before a new request.'};
   const definite=response.status>=400&&response.status<500&&response.status!==408;
   throw new ImageGenerationError(messages[response.status]??'Image generation did not return a confirmed result. Inspect its saved activity before any new request.',definite?'rejected':'uncertain',response.status,safeCode(value?.error?.code));
  }
  const value=await boundedJson(response);context.signal.throwIfAborted();
  if(!Array.isArray(value?.data)||value.data.length!==1||typeof value.data[0]?.b64_json!=='string')throw new Error('The provider returned no single inline image.');
  const b64=value.data[0].b64_json;if(!b64.length||b64.length>Math.ceil(maxGeneratedImageBytes/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))throw new Error('The provider returned invalid or oversized image data.');
  const bytes=Buffer.from(b64,'base64');if(bytes.toString('base64')!==b64)throw new Error('The image encoding is invalid.');const mediaType=rasterImageType(bytes);
  if(value.data[0].media_type!==undefined&&value.data[0].media_type!==mediaType)throw new Error('The returned image does not match its declared format.');
  await context.validate();context.signal.throwIfAborted();
  const cost=value.usage?.cost,costUSD=typeof cost==='number'&&Number.isFinite(cost)&&cost>=0?cost:null,requestId=response.headers.get('x-request-id')??value.id;
  return {bytes,mediaType,sha256:createHash('sha256').update(bytes).digest('hex'),provider:connection.provider,model:connection.model,costUSD,...(safeCode(requestId)?{providerRequestId:requestId}:{})};
 }catch(error){if(error instanceof ImageGenerationError)throw error;throw new ImageGenerationError(dispatched?'The image request has no safely publishable confirmed result. Inspect its saved activity before any new generation.':'The image request was not sent. Check its connection, references and current permissions.',dispatched?'uncertain':'before-dispatch');}
}
