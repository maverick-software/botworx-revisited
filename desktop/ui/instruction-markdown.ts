import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

const parser=unified().use(remarkParse).use(remarkGfm);
// These nodes need their original source: the rich editor cannot represent them.
const sourceOnly=new Set(['html','image','imageReference','linkReference','definition','footnoteDefinition','footnoteReference']);
function clean(value:unknown):unknown{
 if(Array.isArray(value))return value.map(clean);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['position','data','spread'].includes(key)).map(([key,item])=>[key,clean(item)]));
 return value;
}
export function instructionTree(text:string){return parser.parse(text);}
export function instructionsNeedSource(text:string):boolean{
 const visit=(node:any):boolean=>sourceOnly.has(node.type)||(node.children??[]).some(visit);
 return visit(instructionTree(text));
}
/** Compare parsed meaning, allowing formatting syntax changes but no lost nodes. */
export function sameInstructionMarkdown(original:string,formatted:string){
 return JSON.stringify(clean(instructionTree(original)))===JSON.stringify(clean(instructionTree(formatted)));
}
