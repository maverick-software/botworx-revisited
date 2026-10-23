import {agentId} from './agent-contracts';

export type LibraryExpected={version:number;updatedAt:string};
export function libraryExpected(value:unknown):LibraryExpected{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Refresh the library before changing this document.');
 const row=value as Record<string,unknown>;
 if(!Number.isSafeInteger(row.version)||(row.version as number)<1||typeof row.updatedAt!=='string'||row.updatedAt.length>80||!Number.isFinite(Date.parse(row.updatedAt)))throw Error('Refresh the library before changing this document.');
 return {version:row.version as number,updatedAt:row.updatedAt};
}
export function libraryMetadata(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Enter the document details.');
 const row=value as Record<string,unknown>,text=(value:unknown,max:number,required=false)=>{
  if(typeof value!=='string'||value.length>max||value.includes('\0'))throw Error('Enter valid document details.');
  const result=value.trim();if(required&&!result)throw Error('Enter a document name and collection.');return result;
 };
 if(!Array.isArray(row.tags)||row.tags.length>20)throw Error('Use at most 20 tags.');
 return {name:text(row.name,255,true),category:text(row.category,50,true),description:text(row.description,4000),tags:[...new Set(row.tags.map(tag=>text(tag,40,true)))]};
}
export function libraryVersion(value:unknown){if(!Number.isSafeInteger(value)||(value as number)<1)throw Error('Choose a previous file version.');return value as number;}
export function libraryMutation(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Choose a library operation.');
 const row=value as Record<string,unknown>,operation=row.operation;
 if(!['metadata','archive','restore','delete','restore_version','delete_version'].includes(String(operation)))throw Error('Unsupported library operation.');
 return {id:agentId(row.id),expected:libraryExpected(row.expected),operation:operation as string,
  value:operation==='metadata'?libraryMetadata(row.value):['restore_version','delete_version'].includes(String(operation))?{version:libraryVersion((row.value as Record<string,unknown>)?.version)}:{}};
}
