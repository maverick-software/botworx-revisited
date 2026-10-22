import {composioRecord} from './composio-contracts';

export const googleOfficeTypes={
 '.docx':{name:'Docs',source:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',target:'application/vnd.google-apps.document',editor:'document'},
 '.xlsx':{name:'Sheets',source:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',target:'application/vnd.google-apps.spreadsheet',editor:'spreadsheets'},
 '.pptx':{name:'Slides',source:'application/vnd.openxmlformats-officedocument.presentationml.presentation',target:'application/vnd.google-apps.presentation',editor:'presentation'},
} as const;
export type GoogleOfficeExtension=keyof typeof googleOfficeTypes;
export type GoogleDocumentOperation={id:string;binding:string;connectionId:string;referenceId:string;relative:string;name:string;sha256:string;bytes:number;extension:GoogleOfficeExtension;phase:'preparing'|'creating'|'held'|'completed'|'retryable';createdAt:string;updatedAt:string;cloudId?:string};
export type GoogleDocumentJournal={format:1;operations:GoogleDocumentOperation[]};
export type GoogleDocumentResult={kind:'opened'|'held'|'retryable';operationId:string;notice?:string;url?:string;sourceChanged?:boolean};
export type GoogleDocumentAccounts={kind:'accounts';accounts:{id:string;name:string}[]};
const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const googleFileId=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(value);
const fields=(value:unknown,names:string[])=>composioRecord(value)&&Object.keys(value).every(key=>names.includes(key));
/** Separate from connection state, so older applications can still read their saved connections. */
export function googleDocumentJournal(value:unknown):GoogleDocumentJournal{
 if(!fields(value,['format','operations'])||!composioRecord(value)||value.format!==1||!Array.isArray(value.operations)||value.operations.length>500||JSON.stringify(value).length>2000000)throw Error('Invalid saved Google document operations.');
 const ids=new Set<string>(),keys=new Set<string>();
 for(const row of value.operations){
  if(!fields(row,['id','binding','connectionId','referenceId','relative','name','sha256','bytes','extension','phase','createdAt','updatedAt','cloudId'])||!composioRecord(row)||!uuid(row.id)||ids.has(row.id)||!hash(row.binding)||!uuid(row.connectionId)||!uuid(row.referenceId)||typeof row.relative!=='string'||row.relative.length>500||/[:\\\x00-\x1f\x7f]/.test(row.relative)||row.relative.startsWith('/')||row.relative.split('/').some((part:string)=>part==='..'||part==='.')||typeof row.name!=='string'||!row.name.trim()||row.name.length>255||/[\\/\x00-\x1f\x7f]/.test(row.name)||!hash(row.sha256)||!Number.isInteger(row.bytes)||row.bytes<1||row.bytes>20*1024*1024||!Object.hasOwn(googleOfficeTypes,row.extension)||!row.name.toLowerCase().endsWith(row.extension)||!['preparing','creating','held','completed','retryable'].includes(row.phase)||[row.createdAt,row.updatedAt].some(time=>typeof time!=='string'||!Number.isFinite(Date.parse(time)))||row.cloudId!==undefined&&!googleFileId(row.cloudId)||row.phase==='completed'&&!row.cloudId)throw Error('Invalid saved Google document operation.');
  const key=JSON.stringify([row.binding,row.referenceId,row.relative,row.sha256]);if(keys.has(key))throw Error('Duplicate saved Google document operation.');ids.add(row.id);keys.add(key);
 }
 return structuredClone(value) as GoogleDocumentJournal;
}
export function googleDocumentUrl(extension:GoogleOfficeExtension,id:string){if(!googleFileId(id))throw Error('Google returned an invalid document identifier.');return 'https://docs.google.com/'+googleOfficeTypes[extension].editor+'/d/'+id+'/edit';}
