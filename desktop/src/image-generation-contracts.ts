import type {ToolDefinition} from './tool-contracts';

export const imageGenerationPluginName='image-generation';
export const imageGenerationToolName='generate_image';
export const maxGeneratedImageBytes=32*1024*1024;
export type ImageProvider='openrouter'|'openai-api';
export type ImageConnection={enabled:boolean;provider:ImageProvider;model:string};
export type RasterImageType='image/png'|'image/jpeg'|'image/webp';
export type ImageReference={bytes:Buffer;mediaType:RasterImageType};
export type ImageGenerationInput={prompt:string;transparentBackground:boolean;references:ImageReference[]};
export type ImageGenerationArguments={prompt:string;transparent_background:boolean;references:Array<{kind:'attachment'|'generated';id:string}>};
export type ImageGenerationResult={bytes:Buffer;mediaType:RasterImageType;sha256:string;provider:ImageProvider;model:string;providerRequestId?:string;costUSD:number|null};
export type ImageOperationOutcome='before-dispatch'|'rejected'|'uncertain';
export class ImageGenerationError extends Error{
 constructor(message:string,readonly outcome:ImageOperationOutcome,readonly httpStatus?:number,readonly providerCode?:string){super(message);this.name='ImageGenerationError';}
}

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function imageConnection(value:unknown):ImageConnection{
 if(!object(value)||Object.keys(value).some(key=>!['enabled','provider','model'].includes(key))||typeof value.enabled!=='boolean'||!['openrouter','openai-api'].includes(String(value.provider))||typeof value.model!=='string'||value.model.length>200||value.model!==value.model.trim()||value.model&&!/^[a-z0-9][a-z0-9._:/-]+$/i.test(value.model)||value.model.includes('://')||value.model.includes('..'))throw new Error('Choose an explicit image connection and model. Credentials and endpoint URLs do not belong in this configuration.');
 if(value.enabled&&!value.model)throw new Error('Choose an image model before enabling image generation.');
 return {enabled:value.enabled,provider:value.provider as ImageProvider,model:value.model};
}
export function imageGenerationArguments(value:unknown):ImageGenerationArguments{
 if(!object(value)||Object.keys(value).some(key=>!['prompt','transparent_background','references'].includes(key))||typeof value.prompt!=='string'||!value.prompt.trim()||value.prompt.length>32000||typeof value.transparent_background!=='boolean'||!Array.isArray(value.references)||value.references.length>5)throw new Error('Provide the image prompt, background choice and up to five selected image references.');
 const references=value.references.map(reference=>{if(!object(reference)||Object.keys(reference).some(key=>!['kind','id'].includes(key))||!['attachment','generated'].includes(String(reference.kind))||typeof reference.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(reference.id))throw new Error('Image references must identify selected attachments or generated assets.');return {kind:reference.kind as 'attachment'|'generated',id:reference.id};});
 if(new Set(references.map(reference=>reference.kind+':'+reference.id)).size!==references.length)throw new Error('Choose each image reference only once.');
 return {prompt:value.prompt,transparent_background:value.transparent_background,references};
}
export const imageGenerationTool:ToolDefinition={name:imageGenerationToolName,namespace:'tools',annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true},description:'Generate or edit one image through the explicitly configured image-generation plugin. This uses that plugin’s separate paid connection, including when the chat uses a ChatGPT plan. Describe the requested image or edit; use only selected attachment or generated-image references. Default permissions review connection, cost and reference sharing before dispatch. Full access authorizes the configured image tool automatically. Do not retry an uncertain or interrupted generation; inspect its saved activity and report the uncertainty.',parameters:{type:'object',additionalProperties:false,required:['prompt','transparent_background','references'],properties:{prompt:{type:'string',minLength:1,maxLength:32000},transparent_background:{type:'boolean'},references:{type:'array',maxItems:5,items:{type:'object',additionalProperties:false,required:['kind','id'],properties:{kind:{type:'string',enum:['attachment','generated']},id:{type:'string',format:'uuid'}}}}}}};
