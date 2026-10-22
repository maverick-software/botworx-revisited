import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('prepare larger original image attachments');
const root=path.resolve(import.meta.dirname,'../..');
async function replace(name,before,after,count){const file=path.join(root,name),text=await readFile(file,'utf8');assert.equal(text.split(before).length-1,count,name);await writeFile(file,text.replaceAll(before,after));}
await replace('desktop/src/restored-clipboard.ts','regular(file,2*1024**2)','regular(file,clipboardLimit)',3);
await replace('desktop/runtime/prepare-desktop-recovery.py',"0<ref['bytes']<=2*1024**2","0<ref['bytes']<=20*1024**2",1);
const main=path.join(root,'desktop/src/main.ts'),text=await readFile(main,'utf8');
assert(!text.includes("import {maxAttachmentRequestBytes}"));
await writeFile(main,"import {maxAttachmentRequestBytes} from './image-limits';\n"+text.replace('JSON.stringify(args).length>11500000','JSON.stringify(args).length>maxAttachmentRequestBytes'));
const manifestFile=path.join(root,'desktop/src/recovery-resource-manifest.json'),manifest=JSON.parse(await readFile(manifestFile,'utf8'));
manifest.files['runtime/prepare-desktop-recovery.py']=createHash('sha256').update(await readFile(path.join(root,'desktop/runtime/prepare-desktop-recovery.py'))).digest('hex');
await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
console.log('Attachment IPC and clipboard recovery limits updated; recovery fingerprint refreshed.');
