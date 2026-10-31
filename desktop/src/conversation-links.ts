import {currentFileHref} from './legacy-brand';
import type {ProjectMemorySource} from './contracts';
export const conversationId=(value:unknown)=>{if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new Error('Invalid conversation source identifier.');return value;};
export function conversationCitation(conversation:string,message:string){return 'sylvana-chat://'+conversationId(conversation)+'/message/'+conversationId(message);}
export function parseConversationCitation(value:string){const url=new URL(currentFileHref(value));if(url.protocol!=='sylvana-chat:'||url.username||url.password||url.port||url.search||url.hash)throw new Error('Invalid conversation source link.');const match=/^\/message\/([^/]+)$/.exec(url.pathname);if(!match)throw new Error('Invalid conversation source link.');return {conversationId:conversationId(url.hostname),messageId:conversationId(match[1])};}
export function memorySources(value:unknown):ProjectMemorySource[]{if(!Array.isArray(value))return [];return value.map(row=>({...row,citation:conversationCitation(row.conversation_id,row.message_id)}));}
