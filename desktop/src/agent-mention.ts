export type AgentMention={start:number;end:number;query:string};
/** A mention is explicit composer syntax. Email, quoted prose and code stay text. */
export function agentMention(text:string,caret:number):AgentMention|null{return mentionAt(text,caret,false);}
export function contextMention(text:string,caret:number):AgentMention|null{return mentionAt(text,caret,true);}
function mentionAt(text:string,caret:number,context:boolean):AgentMention|null{
 if(!Number.isSafeInteger(caret)||caret<0||caret>text.length)return null;
 const prefix=text.slice(0,caret),match=(context?/(?:^|\s)@([\p{L}\p{N}_./-]*)$/u:/(?:^|\s)@([a-zA-Z0-9_-]*)$/).exec(prefix);if(!match)return null;
 const start=caret-match[1].length-1,line=text.slice(0,start).split('\n').at(-1)??'';
 if(/^\s*>/.test(line))return null;
 let fence:string|null=null,inline=0;
 for(const row of text.slice(0,start).split('\n')){
  const marker=/^\s*(`{3,}|~{3,})/.exec(row);
  if(marker){if(!fence)fence=marker[1][0];else if(fence===marker[1][0])fence=null;inline=0;continue;}
  if(!fence){const ticks=row.match(/(?<!\\)`+/g)??[];for(const run of ticks){if(!inline)inline=run.length;else if(inline===run.length)inline=0;}}
 }
 if(fence||inline||start>0&&text[start-1]==='\\')return null;
 return {start,end:caret,query:match[1].toLowerCase()};
}
export function removeAgentMention(text:string,mention:AgentMention){return text.slice(0,mention.start)+text.slice(mention.end).replace(/^ /,'');}
export function leadingAgentAddress(text:string):string|null{return /^\s*@([\p{L}\p{N}_-]+)(?=$|[\s,:])/u.exec(text)?.[1].toLowerCase()??null;}
export function resolveAgentAddress<T extends {id:string;name:string;handle?:string;active?:boolean}>(text:string,agents:T[]):T|null{
 const address=leadingAgentAddress(text);if(!address)return null;const active=agents.filter(agent=>agent.active!==false);
 const handles=active.filter(agent=>agent.handle?.toLowerCase()===address);if(handles.length===1)return handles[0];
 const names=active.filter(agent=>agent.name.toLowerCase()===address);if(names.length===1)return names[0];
 if(names.length>1||handles.length>1)throw new Error('Several agents match @'+address+'. Choose the intended agent from the @ picker.');
 throw new Error('No active agent matches @'+address+'. Choose an agent from the @ picker.');
}
