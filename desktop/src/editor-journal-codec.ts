import {gzipSync,Gunzip,strToU8,strFromU8} from 'fflate';
import type {EditorDraftRecord,EditorDraftWrite} from './agent-editor-draft-contracts';

export type EditorJournal={version:1;owner:string;scope:string;base:EditorDraftRecord|null;value:string|null;pending:EditorDraftWrite|null;rejected?:string|null};
type Patch={from:number;prefix:number;suffix:number;text:string};
const maxText=8000000,maxJsonBytes=64000000,maxEncoded=16000000;
const fail=()=>{throw Error('The local draft journal is corrupt or exceeds its recovery limit.');};
const object=(value:unknown):Record<string,any>=>{if(!value||typeof value!=='object'||Array.isArray(value))return fail();return value as Record<string,any>;};
const keys=(value:Record<string,any>,allowed:string[])=>{if(Object.keys(value).some(key=>!allowed.includes(key)))fail();};
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=(bytes:Uint8Array)=>{let c=0xffffffff;for(const byte of bytes)c=crcTable[(c^byte)&255]^(c>>>8);return ((c^0xffffffff)>>>0).toString(16).padStart(8,'0');};
function base64(bytes:Uint8Array){let result='';for(let offset=0;offset<bytes.length;offset+=24576)result+=btoa(String.fromCharCode(...bytes.subarray(offset,offset+24576)));return result;}
function unpack(raw:string){if(raw.length>maxEncoded)fail();if(!raw.startsWith('AGD2G:'))return JSON.parse(raw);const match=/^AGD2G:([0-9]{1,8}):([a-f0-9]{8}):([A-Za-z0-9+/]+={0,2})$/.exec(raw);if(!match)fail();const size=Number(match![1]);if(!Number.isSafeInteger(size)||size>maxJsonBytes||size<2)fail();const binary=atob(match![3]),bytes=Uint8Array.from(binary,char=>char.charCodeAt(0)),output=new Uint8Array(size);if(bytes.length<18||bytes[0]!==31||bytes[1]!==139||bytes[2]!==8||bytes[3]!==0)fail();let written=0,finished=false;
 const decoder=new Gunzip((chunk,final)=>{if(written+chunk.length>size)fail();output.set(chunk,written);written+=chunk.length;finished=final;});
 for(let offset=0;offset<bytes.length;offset+=4096)decoder.push(bytes.subarray(offset,offset+4096),offset+4096>=bytes.length);
 if(!finished||written!==size||crc(output)!==match![2])fail();return JSON.parse(strFromU8(output));}

/** The newest strings occur once. Older payloads reuse them or store a lossless
 * prefix/suffix patch. Compression is optional and bounded during decoding. */
export function encodeEditorJournal(row:EditorJournal):string{
 const texts:string[]=[],values:Array<string|Patch>=[],indices=new Map<string,number>();
 const ref=(value:string|null)=>{if(value===null)return null;if(typeof value!=='string'||value.length>maxText)fail();const found=indices.get(value);if(found!==undefined)return found;let packed:string|Patch=value,cost=JSON.stringify(value).length;
  for(let n=0;n<texts.length;n++){const from=texts[n];let prefix=0;while(prefix<from.length&&prefix<value.length&&from.charCodeAt(prefix)===value.charCodeAt(prefix))prefix++;let suffix=0;while(suffix<from.length-prefix&&suffix<value.length-prefix&&from.charCodeAt(from.length-1-suffix)===value.charCodeAt(value.length-1-suffix))suffix++;const patch={from:n,prefix,suffix,text:value.slice(prefix,value.length-suffix)},size=JSON.stringify(patch).length;if(size<cost){packed=patch;cost=size;}}
  const n=texts.length;texts.push(value);values.push(packed);indices.set(value,n);return n;};
 const rejected=row.rejected===undefined?undefined:ref(row.rejected),value=ref(row.value),base=row.base?{...row.base,payload:ref(row.base.payload)}:null,pending=row.pending?{...row.pending,payload:ref(row.pending.payload)}:null;
 const json=JSON.stringify({version:2,owner:row.owner,scope:row.scope,values,value,base,pending,...(rejected===undefined?{}:{rejected})});if(json.length>maxJsonBytes)fail();let encoded=json;
 if(json.length>32768){const bytes=strToU8(json);if(bytes.length>maxJsonBytes)fail();const compressed='AGD2G:'+bytes.length+':'+crc(bytes)+':'+base64(gzipSync(bytes,{level:1,mtime:0}));if(compressed.length<encoded.length)encoded=compressed;}
 if(encoded.length>maxEncoded)fail();return encoded;
}
export function decodeEditorJournal(raw:string,owner:string,scope:string):EditorJournal{
 const row=object(unpack(raw));if(row.owner!==owner||row.scope!==scope)throw Error('The local draft journal changed account or editor.');
 if(row.version===1){keys(row,['version','owner','scope','base','value','pending','rejected']);if(row.value!==null&&(typeof row.value!=='string'||row.value.length>maxText))fail();return row as EditorJournal;}
 if(row.version!==2)fail();keys(row,['version','owner','scope','values','value','base','pending','rejected']);if(!Array.isArray(row.values)||row.values.length>4)fail();const texts:string[]=[];
 for(const packed of row.values){let value:string;if(typeof packed==='string')value=packed;else{const p=object(packed);keys(p,['from','prefix','suffix','text']);if(!Number.isInteger(p.from)||p.from<0||p.from>=texts.length||!Number.isSafeInteger(p.prefix)||!Number.isSafeInteger(p.suffix)||p.prefix<0||p.suffix<0||typeof p.text!=='string')fail();const from=texts[p.from];if(p.prefix+p.suffix>from.length)fail();value=from.slice(0,p.prefix)+p.text+from.slice(from.length-p.suffix);}if(value.length>maxText)fail();texts.push(value);}
 const read=(ref:unknown)=>{if(ref===null)return null;if(!Number.isInteger(ref)||(ref as number)<0||(ref as number)>=texts.length)fail();return texts[ref as number];};
 const base=row.base===null?null:{...object(row.base),payload:read(row.base.payload)},pending=row.pending===null?null:{...object(row.pending),payload:read(row.pending.payload)};
 return {version:1,owner,scope,value:read(row.value),base:base as EditorDraftRecord|null,pending:pending as EditorDraftWrite|null,...(Object.hasOwn(row,'rejected')?{rejected:read(row.rejected)}:{})};
}

/** Read only the bounded outer identity, including when other fields are
 * damaged. Callers still validate ownership before exposing any payload. */
export function editorJournalIdentity(raw:string):{owner:string;scope:string}|null{try{const row=object(unpack(raw));return typeof row.owner==='string'&&typeof row.scope==='string'?{owner:row.owner,scope:row.scope}:null;}catch{return null;}}
