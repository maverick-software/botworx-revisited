import type {ImageGenerationInput,ImageProvider} from './image-generation-contracts';

export type ImageModel={id:string;name:string};
export type ImageRoute={providerTag?:string;parameters:Record<string,unknown>;pricing:unknown[]};
async function metadata(url:string,signal:AbortSignal,fetcher:typeof fetch){
 const response=await fetcher(url,{redirect:'error',signal});if(!response.ok){await response.body?.cancel();throw new Error('The image model catalog is unavailable. No image request was sent.');}
 const reader=response.body?.getReader();if(!reader)throw new Error('The image catalog is empty.');let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>2*1024*1024){await reader.cancel();throw new Error('The image catalog exceeds the supported limit.');}chunks.push(item.value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}finally{reader.releaseLock();}
}
export async function imageModels(provider:ImageProvider,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<ImageModel[]>{
 if(provider==='openai-api')return [{id:'gpt-image-2.5-sunburst',name:'GPT Image 2.5 Sunburst'},{id:'gpt-image-2.5-flare',name:'GPT Image 2.5 Flare'},{id:'gpt-image-2',name:'GPT Image 2'}];
 const value=await metadata(provider==='sylvana'?'https://sylvana.invalid/v1/models':'https://openrouter.ai/api/v1/images/models',signal,fetcher);
 if(provider==='sylvana')return value.data.filter((m:any)=>m.capabilities?.includes('images')).map((m:any)=>({id:m.id,name:m.name}));
 if(!Array.isArray(value.data))throw new Error('The image catalog has an unsupported format.');
 return value.data.filter((row:any)=>typeof row.id==='string'&&/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i.test(row.id)&&row.id.length<=200&&row.architecture?.output_modalities?.includes('image')).slice(0,1000).map((row:any)=>({id:row.id,name:typeof row.name==='string'?row.name.slice(0,200):row.id}));
}
function enumValue(parameters:any,name:string,value:string){return parameters[name]?.type==='enum'&&Array.isArray(parameters[name].values)&&parameters[name].values.includes(value);}
function count(parameters:any,name:string,value:number){const p=parameters[name];return p?.type==='range'&&Number.isFinite(p.min)&&Number.isFinite(p.max)&&p.min<=value&&p.max>=value;}
export async function imageRoute(provider:ImageProvider,model:string,input:ImageGenerationInput,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<ImageRoute>{
 if(provider==='openai-api'){if(!/^gpt-image-[a-z0-9.-]+$/i.test(model))throw new Error('Choose a supported OpenAI image model.');return {parameters:{},pricing:[]};}
 if(provider==='sylvana'){if(!['standard','advanced'].includes(model))throw Error('Choose Standard or Advanced for image generation.');const value=await metadata('https://sylvana.invalid/v1/images/models/'+model+'/endpoints',signal,fetcher);const p=value.endpoints?.[0]?.supported_parameters??{};if(input.transparentBackground&&(!enumValue(p,'background','transparent')||!enumValue(p,'output_format','png')))throw Error('This Sylvana image service level does not support transparent backgrounds.');return {parameters:{...(p.background&&input.transparentBackground?{background:'transparent'}:{}),...(p.output_format?{output_format:'png'}:{})},pricing:[]};}
 if(!/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i.test(model))throw new Error('Choose a catalog image model.');
 const value=await metadata('https://openrouter.ai/api/v1/images/models/'+model.split('/').map(encodeURIComponent).join('/')+'/endpoints',signal,fetcher);
 if(value.id!==model||!Array.isArray(value.endpoints))throw new Error('The image endpoint catalog has an unsupported format.');
 for(const endpoint of value.endpoints){
  const p=endpoint.supported_parameters;if(!p||typeof p!=='object'||Array.isArray(p)||typeof endpoint.provider_tag!=='string'||!/^[a-z0-9][a-z0-9._/-]{0,100}$/i.test(endpoint.provider_tag))continue;
  if(input.transparentBackground&&(!enumValue(p,'background','transparent')||!enumValue(p,'output_format','png')))continue;
  if(input.references.length&&!count(p,'input_references',input.references.length))continue;
  if(p.n!==undefined&&!count(p,'n',1))continue;
  const parameters:Record<string,unknown>={};if(count(p,'n',1))parameters.n=1;
  if(enumValue(p,'output_format','png'))parameters.output_format='png';
  if(input.transparentBackground)parameters.background='transparent';else if(enumValue(p,'background','opaque'))parameters.background='opaque';
  return {providerTag:endpoint.provider_tag,parameters,pricing:Array.isArray(endpoint.pricing)?endpoint.pricing.slice(0,20).map((price:any)=>({billable:String(price.billable??'').slice(0,80),unit:String(price.unit??'').slice(0,40),cost_usd:typeof price.cost_usd==='number'&&Number.isFinite(price.cost_usd)&&price.cost_usd>=0?price.cost_usd:null})):[]};
 }
 throw new Error('The selected model has no endpoint supporting this background and reference-image request. Choose a compatible image model; no image request was sent.');
}
