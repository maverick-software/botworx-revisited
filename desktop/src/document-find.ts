export type TextMatch={start:number;end:number};
/** Literal matches retain original UTF-16 offsets, including case-insensitive Unicode. */
export function documentMatches(text:string,query:string,matchCase=false):TextMatch[]{
 if(!query||query.length>512)return [];
 const pattern=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return Array.from(text.matchAll(new RegExp(pattern,matchCase?'gu':'giu')),match=>({start:match.index!,end:match.index!+match[0].length}));
}
