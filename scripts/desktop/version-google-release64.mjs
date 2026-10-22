import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
for(const file of ['package.json','package-lock.json']){const value=JSON.parse(await readFile(file,'utf8'));assert.equal(value.version,'0.44.63');value.version='0.44.64';if(file==='package-lock.json'){assert.equal(value.packages[''].version,'0.44.63');value.packages[''].version='0.44.64';}await writeFile(file,JSON.stringify(value,null,2)+'\n');}
const file='scripts/desktop/build.mjs',source=await readFile(file,'utf8');assert.equal(source.split('desktopRecovery:10').length,2);await writeFile(file,source.replace('desktopRecovery:10','desktopRecovery:recoveryManifest.format'));
