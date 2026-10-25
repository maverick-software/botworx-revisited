import {createHash,randomUUID} from 'node:crypto';
import {lstat,mkdir,readFile,readdir,rename,statfs,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {backupDirectory} from './backup-archives';
import {draftPreviewId} from './agent-draft-preview-contracts';
import {editorRetirement,editorRetirementKind,editorRetirementKeys,editorRetirementLocation,type EditorRetirement,type EditorRetirementInput,type EditorRetirementTombstone} from './editor-journal-retirement';

export const editorJournalDirectory='editor-draft-journals';
export const editorJournalPrefixes=['agentopia.editor-draft.','agentopia.preview.'] as const;
export const editorJournalLimits={text:16000000,fileBytes:128*1024**2,totalBytes:512*1024**2,records:10000};
export type EditorJournalEntry=readonly [key:string,raw:string];
export type EditorJournalSnapshot={version:1;sequence:number;key:string;raw:string};
const snapshotName=/^([0-9]{16})-([a-f0-9]{64})\.json$/;
export const editorJournalMember=(name:string)=>name===editorJournalDirectory||name.startsWith(editorJournalDirectory+'/')&&snapshotName.test(name.slice(editorJournalDirectory.length+1));
function fail():never{throw Error('The retained emergency-draft inventory is invalid or exceeds its recovery limit. Preserve the profile before retrying.');}
export function editorJournalEntry(value:unknown):EditorJournalEntry{
 if(!Array.isArray(value)||value.length!==2||typeof value[0]!=='string'||value[0].length>512||!editorJournalPrefixes.some(prefix=>value[0].startsWith(prefix))||value[0].includes('\0')||typeof value[1]!=='string'||value[1].length>editorJournalLimits.text)fail();return [value[0],value[1]];
}
export function editorJournalSnapshot(value:unknown):EditorJournalSnapshot{
 if(!value||typeof value!=='object'||Array.isArray(value))return fail();const v=value as EditorJournalSnapshot;
 if(Object.keys(v).sort().join(',')!=='key,raw,sequence,version'||v.version!==1||!Number.isSafeInteger(v.sequence)||v.sequence<1||v.sequence>9999999999999999)fail();editorJournalEntry([v.key,v.raw]);return v;
}
const sha=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
export const editorJournalRawHash=(raw:string)=>sha(Buffer.from(JSON.stringify(raw)));
function retirements(records:EditorJournalSnapshot[]){const byId=new Map(records.map(row=>[row.sequence,row])),result=new Map<string,EditorRetirement>(),hashes=new Map<number,string>();const rawHash=(row:EditorJournalSnapshot)=>{let value=hashes.get(row.sequence);if(!value){value=editorJournalRawHash(row.raw);hashes.set(row.sequence,value);}return value;};for(const row of records){const marker=editorRetirement(row.raw);if(!marker)continue;const original=byId.get(marker.archiveId);if(!original||original.key!==row.key||original.raw!==row.raw||marker.key!==row.key||marker.archiveId>row.sequence)fail();
 for(const ref of marker.discarded){const copy=byId.get(ref.id);if(!copy||copy.key!==marker.key||rawHash(copy)!==ref.sha256)fail();}for(const id of marker.inputs){const copy=byId.get(id);if(!copy)fail();const binding=editorRetirementLocation(copy.key,marker.owner);if(binding.scope!==marker.scope||marker.scope===null&&copy.key!==marker.key)fail();}
 const previous=result.get(marker.key);if(!previous||marker.archiveId>previous.archiveId)result.set(marker.key,marker);}return result;}
function checkedEntries(input:unknown){if(!Array.isArray(input)||input.length>editorJournalLimits.records)fail();const found=new Set<string>();return input.map(value=>{const row=editorJournalEntry(value);if(found.has(row[0]))fail();found.add(row[0]);return row;}).sort(([a],[b])=>a<b?-1:a>b?1:0);}
/** Immutable, content-sealed copies include corrupt journals as passive data.
 * Only the two draft key families are admitted; no cookies or auth state. */
export class EditorJournalInventory{
 readonly directory:string;private queue:Promise<unknown>=Promise.resolve();
 constructor(private profile:string,private reserveBytes=1024**3){this.directory=path.join(profile,editorJournalDirectory);}
 private async scan(){
  await backupDirectory(this.profile);try{await backupDirectory(this.directory);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {records:[] as EditorJournalSnapshot[],bytes:0};throw error;}
  const names=(await readdir(this.directory)).sort();if(names.length>editorJournalLimits.records+100)fail();const records:EditorJournalSnapshot[]=[],sequences=new Set<number>();let bytes=0;
  for(const name of names){if(/^\.pending-[a-f0-9-]{36}\.tmp$/.test(name))continue;const match=snapshotName.exec(name);if(!match)fail();const file=path.join(this.directory,name),before=await lstat(file);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>editorJournalLimits.fileBytes)fail();const data=await readFile(file),after=await lstat(file);if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||sha(data)!==match![2])fail();const row=editorJournalSnapshot(JSON.parse(data.toString('utf8')));if(row.sequence!==Number(match![1])||sequences.has(row.sequence))fail();sequences.add(row.sequence);records.push(row);bytes+=data.length;if(bytes>editorJournalLimits.totalBytes||records.length>editorJournalLimits.records)fail();}
  return {records,bytes};
 }
 async latest(){const {records}=await this.scan(),latest=new Map<string,EditorJournalSnapshot>();for(const row of records)latest.set(row.key,row);const markers=retirements(records),byId=new Map(records.map(row=>[row.sequence,row]));for(const[key,marker]of markers){const row=latest.get(key),digest=row?editorJournalRawHash(row.raw):null;if(!row||row.sequence<=marker.archiveId||marker.discarded.some(copy=>copy.sha256===digest))latest.set(key,byId.get(marker.archiveId)!);}return [...latest.values()].map(row=>[row.key,row.raw] as EditorJournalEntry).sort(([a],[b])=>a<b?-1:a>b?1:0);}
 async retirementReplacements(entries:EditorJournalEntry[]){const {records}=await this.scan(),markers=retirements(records);return entries.flatMap(([key,raw])=>{const marker=markers.get(key);if(!marker)return [];const digest=editorJournalRawHash(raw);return marker.discarded.some(copy=>copy.sha256===digest)?[[key,raw,JSON.stringify(marker)] as const]:[];});}
 async history(){return structuredClone((await this.scan()).records);}
 async verifyRetirement(id:number){const {records}=await this.scan();retirements(records);const row=records.find(row=>row.sequence===id),marker=row?editorRetirement(row.raw):null;if(!marker||marker.archiveId!==id)throw Error('The saved retirement receipt is unavailable.');return marker;}
 async flush(){await this.queue;}
 capture(input:unknown,guard:()=>Promise<void>=async()=>{}){const entries=checkedEntries(input),work=this.queue.then(async()=>{await guard();return this.write(entries,guard);});this.queue=work.catch(()=>{});return work;}
 /** Archive IDs name only copies inspected before retirement. The callback
  * durably clears the matching main revision before any receipt is published.
  * It must not call this same inventory queue. A lost reply may reuse the same
  * operation; incomplete publication resumes only its missing receipt keys. */
 retire(input:EditorRetirementInput,clear:()=>Promise<EditorRetirementTombstone|null>,guard:()=>Promise<void>=async()=>{}){const work=this.queue.then(async()=>{await guard();const {owner,key,operationId}=input,binding=editorRetirementLocation(key,owner);if(!Array.isArray(input.copies)||!input.copies.length||input.copies.length>10000||new Set(input.copies).size!==input.copies.length||input.copies.some(id=>!Number.isSafeInteger(id)||id<1)||draftPreviewId(operationId)!==operationId)fail();
  if(binding.scope===null?input.expectedRevision!==null:!Number.isSafeInteger(input.expectedRevision)||(input.expectedRevision as number)<0||(input.expectedRevision as number)>=Number.MAX_SAFE_INTEGER)fail();
  let {records}=await this.scan();const bindingMain=input.main;if(bindingMain){editorJournalEntry([bindingMain.key,bindingMain.raw]);if(binding.scope===null||editorRetirementLocation(bindingMain.key,owner).scope!==binding.scope)fail();if(!records.some(row=>row.key===bindingMain.key&&row.raw===bindingMain.raw)){await this.write([[bindingMain.key,bindingMain.raw]],guard);records=(await this.scan()).records;}}const mainId=bindingMain?[...records].reverse().find(row=>row.key===bindingMain.key&&row.raw===bindingMain.raw)!.sequence:undefined,copies=[...new Set([...input.copies,...(mainId===undefined?[]:[mainId])])].sort((a,b)=>a-b),byId=new Map(records.map(row=>[row.sequence,row])),selected=copies.map(id=>{const row=byId.get(id);if(!row)fail();const next=editorRetirementLocation(row.key,owner);if(next.scope!==binding.scope||binding.scope===null&&row.key!==key)fail();return row;});if(copies.length>10000||!selected.some(row=>row.key===key))fail();
  const keys=[...new Set([...editorRetirementKeys(owner,key),...selected.map(row=>row.key)])].sort(),existing=retirements(records),expected=binding.scope===null?null:{revision:input.expectedRevision!+1,writeId:operationId},prior=[...existing.values()].filter(row=>row.owner===owner&&row.operationId===operationId);for(const row of prior)if(JSON.stringify(row.inputs)!==JSON.stringify(copies)||JSON.stringify(row.keys)!==JSON.stringify(keys)||JSON.stringify(row.tombstone)!==JSON.stringify(expected))throw Error('This retirement identity was reused for another inspected copy.');
  const missing=keys.filter(key=>!prior.some(row=>row.key===key));if(!missing.length){await guard();return prior.sort((a,b)=>a.key<b.key?-1:1);}
  if(records.length+missing.length>editorJournalLimits.records)fail();await guard();const tombstone=await clear();await guard();if(JSON.stringify(tombstone)!==JSON.stringify(expected))throw Error('The draft retirement was not acknowledged by the matching main revision.');let sequence=records.at(-1)?.sequence??0;const markers=missing.map(key=>({version:1 as const,kind:editorRetirementKind,owner,key,scope:binding.scope,operationId,archiveId:++sequence,keys,inputs:copies,discarded:selected.filter(row=>row.key===key).map(row=>({id:row.sequence,sha256:editorJournalRawHash(row.raw)})),tombstone}));for(const marker of markers)if(!editorRetirement(JSON.stringify(marker),owner,marker.key))fail();await this.write(markers.map(row=>[row.key,JSON.stringify(row)]),guard);const verified=retirements((await this.scan()).records);await guard();return keys.map(key=>{const row=verified.get(key);if(!row||row.operationId!==operationId)fail();return row;});
 });this.queue=work.catch(()=>{});return work;}
 private async write(entries:EditorJournalEntry[],guard:()=>Promise<void>){const inventory=await this.scan();await guard();const latest=new Map<string,EditorJournalSnapshot>();for(const row of inventory.records)latest.set(row.key,row);let sequence=inventory.records.at(-1)?.sequence??0,total=inventory.bytes;const pending:Array<{name:string;data:Buffer;row:EditorJournalSnapshot}>=[];
  for(const[key,raw]of entries){if(latest.get(key)?.raw===raw)continue;const row=editorJournalSnapshot({version:1,sequence:++sequence,key,raw}),data=Buffer.from(JSON.stringify(row));if(data.length>editorJournalLimits.fileBytes)fail();total+=data.length;pending.push({name:String(sequence).padStart(16,'0')+'-'+sha(data)+'.json',data,row});}
  if(inventory.records.length+pending.length>editorJournalLimits.records||total>editorJournalLimits.totalBytes)fail();if(!pending.length)return {captured:0,retained:inventory.records.length};
  const free=await statfs(this.profile);if(free.bavail*free.bsize-(total-inventory.bytes)<this.reserveBytes)throw Error('Emergency drafts could not be archived while preserving the disk-space reserve. Their original storage is retained.');await mkdir(this.directory,{recursive:true});await backupDirectory(this.directory);
  for(const item of pending){await guard();const temporary=path.join(this.directory,'.pending-'+randomUUID()+'.tmp'),target=path.join(this.directory,item.name);await writeFile(temporary,item.data,{flag:'wx',mode:0o600});await guard();await rename(temporary,target);const verified=await readFile(target);if(!verified.equals(item.data))fail();}
  await this.scan();return {captured:pending.length,retained:inventory.records.length+pending.length};
 }
}

type JournalPage={getURL:()=>string;executeJavaScript:<T=unknown>(code:string)=>Promise<T>};
const readScript=`(()=>{const entries=[];for(let n=0;n<localStorage.length;n++){const key=localStorage.key(n);if(key&&(key.startsWith('agentopia.editor-draft.')||key.startsWith('agentopia.preview.')))entries.push([key,localStorage.getItem(key)]);}return entries.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);})()`;
/** Runs in the trusted blank app origin before renderer startup/migration.
 * It may also capture current copies at a backup barrier. It never evaluates
 * draft contents, overwrites an existing key, or performs a Broker operation. */
export async function preserveEditorJournalStorage(inventory:EditorJournalInventory,page:JournalPage,restoreMissing=false){
 const trusted=()=>{const url=new URL(page.getURL());if(url.protocol!=='agentopia:'||url.hostname!=='app')throw Error('Emergency drafts require the private application origin.');};
 trusted();let entries=checkedEntries(await page.executeJavaScript(readScript)),retired=0;trusted();if(restoreMissing){for(const[key,previous,replacement]of await inventory.retirementReplacements(entries)){trusted();await page.executeJavaScript(`(()=>{const [key,previous,replacement]=JSON.parse(${JSON.stringify(JSON.stringify([key,previous,replacement]))});if(localStorage.getItem(key)!==previous)throw Error('The retired draft changed during startup. Its newer bytes are retained.');localStorage.setItem(key,replacement);if(localStorage.getItem(key)!==replacement)throw Error('The retirement receipt could not be restored.');})()`);trusted();retired++;}entries=checkedEntries(await page.executeJavaScript(readScript));trusted();}const result=await inventory.capture(entries);trusted();const again=checkedEntries(await page.executeJavaScript(readScript));if(JSON.stringify(again)!==JSON.stringify(entries))throw Error('Emergency drafts changed during capture. Their copies are retained; retry the backup.');
 let restored=0,conflicts=0;if(restoreMissing){for(const[key,raw]of await inventory.latest()){trusted();const result=await page.executeJavaScript<'restored'|'same'|'conflict'>(`(()=>{const [key,raw]=JSON.parse(${JSON.stringify(JSON.stringify([key,raw]))});const previous=localStorage.getItem(key);if(previous!==null)return previous===raw?'same':'conflict';localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw Error('An emergency draft could not be restored.');return 'restored';})()`);trusted();if(result==='restored')restored++;else if(result==='conflict')conflicts++;}}
 return {...result,restored,conflicts,retired};
}
