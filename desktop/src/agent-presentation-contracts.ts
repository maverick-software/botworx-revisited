export const agentIcons=['bot','book','compass','pen','briefcase','code','flask','shield'] as const;
export const agentColors=['gray','blue','green','amber','violet','rose'] as const;
export type AgentIcon=typeof agentIcons[number];
export type AgentColor=typeof agentColors[number];
export type AgentStarter={id:string;title:string;prompt:string};
export type AgentAppearance={version:1;icon:AgentIcon;color:AgentColor;starters:AgentStarter[]|null};
export type AgentPresentation=AgentAppearance&{revision:string|null;editable:boolean;avatar:{kind:'default'|'uploaded'|'legacy';digest?:string}};
export const defaultAgentAppearance:AgentAppearance={version:1,icon:'bot',color:'gray',starters:null};
export const defaultAgentStarters:AgentStarter[]=[{id:'review',title:'Review recent work',prompt:'Review your recent work and summarize the current status, unresolved issues, and next steps.'},{id:'draft',title:'Prepare a draft',prompt:'Help me prepare a draft. Ask for the brief, audience, source material, and format you need before writing.'},{id:'plan',title:'Plan next steps',prompt:'Help me plan the next steps for my work. Ask for the objective and approved project context you need.'}];
export function agentAppearance(value:unknown):AgentAppearance{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Choose an agent appearance.');const v=value as Record<string,unknown>;
 if(v.version!==1||!agentIcons.includes(v.icon as AgentIcon)||!agentColors.includes(v.color as AgentColor))throw Error('Choose a supported icon and color.');
 let starters:AgentStarter[]|null=null;
 if(v.starters!==null){if(!Array.isArray(v.starters)||v.starters.length>6)throw Error('Use up to six conversation starters.');const ids=new Set<string>();starters=v.starters.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Enter a conversation starter.');const {id,title,prompt}=row;if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||ids.has(id))throw Error('Conversation starter identifiers must be unique.');ids.add(id);if(typeof title!=='string'||!title.trim()||title.length>80||typeof prompt!=='string'||!prompt.trim()||prompt.length>2000)throw Error('Use a starter title up to80 characters and a prompt up to2,000 characters.');return {id,title:title.trim(),prompt};});}
 return {version:1,icon:v.icon as AgentIcon,color:v.color as AgentColor,starters};
}
export function savedAgentAppearance(metadata:unknown):{appearance:AgentAppearance;editable:boolean}{
 const raw=(metadata&&typeof metadata==='object'&&!Array.isArray(metadata)?metadata as Record<string,unknown>:{}).desktop_presentation;
 if(raw===undefined||raw===null)return {appearance:{...defaultAgentAppearance},editable:true};try{return {appearance:agentAppearance(raw),editable:true};}catch{return {appearance:{...defaultAgentAppearance},editable:false};}
}
export const maxAvatarDataLength=132000;
export function isLocalAgentAvatar(value:unknown):value is string{return typeof value==='string'&&value.length<=maxAvatarDataLength&&/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);}
