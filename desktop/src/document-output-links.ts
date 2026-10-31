const extensions=/\.(?:pdf|docx|xlsx|pptx|md|txt|csv|tsv|json|html?|png|jpe?g|webp|svg)$/i;
export function documentOutputPath(value:string):boolean{
 return value.length<=4000&&/^[a-z]:[\\/]/i.test(value)&&extensions.test(value)&&!/[\x00-\x1f\x7f<>"|?*`]/.test(value)&&value===value.trim()&&!value.split(/[\\/]/).some(part=>part==='.'||part==='..');
}
export function documentOutputHref(value:string):string{
 return value.slice(0,3)+value.slice(3).split(/([\\/])/).map(part=>part==='\\'||part==='/'?part:encodeURIComponent(part)).join('');
}
/** Explicit inline-code document offers, excluding fenced code examples. Opening
 * still requires the existing account, conversation, workspace and regular-file checks. */
export function inlineDocumentOutputs(markdown:string):string[]{
 const paths:string[]=[];let fence:{character:string;length:number}|undefined;
 for(const line of markdown.split(/\r?\n/)){
  const marker=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if(fence){if(marker&&marker[1][0]===fence.character&&marker[1].length>=fence.length&&!marker[2].trim())fence=undefined;continue;}
  if(marker&&(marker[1][0]!=='`'||!marker[2].includes('`'))){fence={character:marker[1][0],length:marker[1].length};continue;}
  const spans=/(^|[^`])(`+)([^`]+?)\2(?!`)/g;let span:RegExpExecArray|null;
  while((span=spans.exec(line))){let value=span[3];if(value.startsWith(' ')&&value.endsWith(' ')&&value.trim())value=value.slice(1,-1);if(documentOutputPath(value))paths.push(value);}
 }
 return paths;
}
