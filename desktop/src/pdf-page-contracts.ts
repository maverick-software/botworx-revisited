export const maxPdfPagesPerRead=2;
export const maxPdfPageImageBytes=1536*1024;
export type PdfPageImage={page:number;width:number;height:number;image:string};
export interface PdfPageRenderer {render(bytes:Uint8Array,pages:number[],signal:AbortSignal):Promise<PdfPageImage[]>;close():void|Promise<void>}
export function pdfPageNumbers(value:unknown,total?:number):number[]{
 if(!Array.isArray(value)||!value.length||value.length>maxPdfPagesPerRead||value.some(page=>!Number.isSafeInteger(page)||page<1||total!==undefined&&page>total)||new Set(value).size!==value.length)throw Error('Choose one or two distinct PDF page numbers within the document.');
 return value;
}
