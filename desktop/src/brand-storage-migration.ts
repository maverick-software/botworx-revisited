import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {currentBrandKey,legacyOrigin} from './legacy-brand';
type Page={getURL:()=>string;loadURL:(url:string)=>Promise<unknown>;webContents:{executeJavaScript:<T>(source:string)=>Promise<T>}};
/** Read the former origin only as a blank, privileged-process-owned migration
 * page. Original values stay local and intact in the recovery inventory. */
export async function migrateBrandBrowserStorage(profile:string,page:Page){
 const record=path.join(profile,'sylvana-browser-migration.json');
 try{const saved=JSON.parse(await readFile(record,'utf8'));if(saved.format!==1||saved.complete!==true)throw Error('The saved browser migration is incomplete.');return;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 await page.loadURL(legacyOrigin+'/draft-recovery-bootstrap');
 if(page.getURL()!==legacyOrigin+'/draft-recovery-bootstrap')throw Error('The migration origin changed.');
 const entries=await page.webContents.executeJavaScript<unknown>(`(()=>{const rows=[];for(let n=0;n<localStorage.length;n++){const key=localStorage.key(n);if(key!==null)rows.push([key,localStorage.getItem(key)]);}return rows;})()`);
 if(!Array.isArray(entries)||entries.length>10000)throw Error('The local browser migration exceeds its limit.');
 let bytes=0;const converted: [string,string][]=[];const keys=new Set<string>();
 for(const row of entries){if(!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||typeof row[1]!=='string')throw Error('A browser recovery record is invalid.');bytes+=Buffer.byteLength(row[0])+Buffer.byteLength(row[1]);if(bytes>512*1024**2)throw Error('The local browser migration exceeds its limit.');const key=currentBrandKey(row[0]);if(keys.has(key))throw Error('Two old storage records map to the same location.');keys.add(key);converted.push([key,row[1]]);}
 const recovery=path.join(profile,'pre-sylvana-browser-storage.json');
 try{await writeFile(recovery,JSON.stringify({format:1,origin:legacyOrigin,entries}),{flag:'wx',mode:0o600});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const saved=JSON.parse(await readFile(recovery,'utf8'));if(JSON.stringify(saved.entries)!==JSON.stringify(entries))throw Error('Browser storage changed since the migration checkpoint.');}
 await page.loadURL('sylvana://app/draft-recovery-bootstrap');
 for(const [key,raw]of converted){if(page.getURL()!=='sylvana://app/draft-recovery-bootstrap')throw Error('The migration origin changed.');await page.webContents.executeJavaScript(`(()=>{const[key,raw]=${JSON.stringify([key,raw])};const old=localStorage.getItem(key);if(old!==null&&old!==raw)throw Error('A newer browser value conflicts with migration.');localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw Error('The browser value could not be verified.');})()`);}
 await writeFile(record,JSON.stringify({format:1,complete:true,records:converted.length,at:new Date().toISOString()}),{flag:'wx',mode:0o600});
}
