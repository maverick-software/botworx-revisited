export type SourceLocation={line:number;column?:number;endLine:number;endColumn?:number};
const integer=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=1&&value<=1000000;
export function sourceLocation(value:unknown):SourceLocation{
 const location=value as SourceLocation;if(!location||!integer(location.line)||!integer(location.endLine)||location.endLine<location.line||location.column!==undefined&&!integer(location.column)||location.endColumn!==undefined&&!integer(location.endColumn)||location.line===location.endLine&&location.endColumn!==undefined&&location.endColumn<(location.column??1))throw new Error('Use positive line and column numbers, with the end after the start.');
 return {line:location.line,endLine:location.endLine,...(location.column!==undefined?{column:location.column}:{}),...(location.endColumn!==undefined?{endColumn:location.endColumn}:{})};
}
export function sourceFragment(value:unknown,strict=false):SourceLocation|null{
 if(typeof value!=='string'||!/^L\d/.test(value))return null;
 try{const match=/^L(\d+)(?:C(\d+))?(?:-L(\d+)(?:C(\d+))?)?$/.exec(value);if(!match)throw new Error('Invalid source line reference.');return sourceLocation({line:Number(match[1]),endLine:Number(match[3]??match[1]),...(match[2]?{column:Number(match[2])}:{}),...(match[4]?{endColumn:Number(match[4])}:{})});}catch(error){if(strict)throw error;return null;}
}
export function sourceFragmentText(value:SourceLocation){const location=sourceLocation(value);return 'L'+location.line+(location.column!==undefined?'C'+location.column:'')+(location.endLine!==location.line||location.endColumn!==undefined?'-L'+location.endLine+(location.endColumn!==undefined?'C'+location.endColumn:''):'');}
/** The trailing location is separate from a Windows drive or an HTTPS port. */
export function sourceLinkSuffix(href:string,hasFragment=true){
 if(/^(?:https?:)?\/\//i.test(href))return {href};
 const hash=hasFragment?href.indexOf('#'):-1,base=hash<0?href:href.slice(0,hash),match=/:(\d+)(?::(\d+)|-(\d+))?$/.exec(base);
 if(!match)return {href};if(hash>=0)throw new Error('Use either a source line suffix or a document section.');
 const location=sourceLocation({line:Number(match[1]),endLine:Number(match[3]??match[1]),...(match[2]?{column:Number(match[2])}:{})});return {href:base.slice(0,match.index),fragment:sourceFragmentText(location)};
}
export function goToSourceLocation(value:string){const text=value.trim();const fragment=/^\d+(?::\d+)?$/.test(text)?'L'+text.replace(':','C'):/^\d+-\d+$/.test(text)?'L'+text.replace('-','-L'):text;const location=sourceFragment(fragment,true);if(!location)throw new Error('Enter a line, line:column, or line range, such as 18, 18:4, or 18-22.');return location;}
export function workspaceSourceLink(referenceId:string,path:string){if(!/^[a-f0-9-]{36}$/i.test(referenceId))throw new Error('Invalid workspace reference.');return 'agentopia-file://'+referenceId+'/'+path.split(/[\\/]/).map(encodeURIComponent).join('/');}
