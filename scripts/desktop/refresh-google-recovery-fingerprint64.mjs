import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const file='desktop/src/recovery-resource-manifest.json',manifest=JSON.parse(await readFile(file,'utf8'));if(manifest.format!==11)throw Error('Expected recovery capability 11');manifest.files['runtime/prepare-desktop-recovery.py']=createHash('sha256').update(await readFile('desktop/runtime/prepare-desktop-recovery.py')).digest('hex');await writeFile(file,JSON.stringify(manifest,null,2)+'\n');
