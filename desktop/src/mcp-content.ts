import {imageData,maxImageBytes} from './attachment-images';
import {maxPdfPageImageBytes,pdfPageNumbers} from './pdf-page-contracts';
export function mcpImages(result:any){
 const images:{type:'image';mimeType:string;data:string}[]=[];
 for(const part of Array.isArray(result?.content)?result.content:[]){if(part?.type!=='image')continue;if(images.length>=2||!['image/png','image/jpeg','image/webp'].includes(part.mimeType)||typeof part.data!=='string'||part.data.length>2*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(part.data))throw new Error('The MCP image exceeds the supported image format or size limit.');const bytes=Buffer.from(part.data,'base64');if(bytes.toString('base64')!==part.data||!imageData(bytes).startsWith('data:'+part.mimeType+';'))throw new Error('The MCP image data does not match its declared format.');images.push({type:'image',mimeType:part.mimeType,data:part.data});}
 if(result?.pageImages!==undefined){if(result.document?.kind!=='pdf'||!Array.isArray(result.pageImages))throw Error('Page images require a PDF result.');pdfPageNumbers(result.pageImages.map((page:any)=>page?.page),result.document.totalUnits);for(const page of result.pageImages){const match=typeof page.image==='string'&&/^data:(image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(page.image);if(!match||images.length>=2||match[2].length>maxPdfPageImageBytes*4/3+4)throw Error('The PDF page image exceeds its format or count limit.');const bytes=Buffer.from(match[2],'base64');if(bytes.length>maxPdfPageImageBytes||bytes.toString('base64')!==match[2]||imageData(bytes)!==page.image)throw Error('Invalid PDF page image bytes.');images.push({type:'image',mimeType:match[1],data:match[2]});}}
 return images;
}
export function nativeMcpResult(result:unknown){
 const value=result as any,images=mcpImages(value);let direct=false;
 if(typeof value?.image==='string'&&value.image.startsWith('data:image/')){
  if(value.image.length>Math.ceil(maxImageBytes/3)*4+64)throw Error('The file preview image exceeds 20 MB.');
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.image);
  if(!match||images.length>=2)throw Error('The file preview image has an unsupported format or image count.');
  const bytes=Buffer.from(match[2],'base64');if(bytes.toString('base64')!==match[2]||imageData(bytes)!==value.image)throw Error('The file preview image bytes do not match their declared format.');
  images.push({type:'image',mimeType:match[1],data:match[2]});direct=true;
 }
 const text=images.length?JSON.stringify({...value,...(direct?{image:'Image included with this tool result.'}:{}),...(Array.isArray(value.pageImages)?{pageImages:value.pageImages.map(({image,...page}:any)=>({...page,image:'Page image included with this tool result.'}))}:{}),...(Array.isArray(value.content)?{content:value.content.map((p:any)=>p.type==='image'?{type:'image',mimeType:p.mimeType,notice:'Image included with this tool result.'}:p)}:{})}):JSON.stringify(result);
 return {content:[{type:'text' as const,text},...images] as [{type:'text';text:string},...typeof images],isError:!!(value&&typeof value==='object'&&('error' in value||value.isError===true))};
}
