import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('isolated folder receipt migration qualification');
const root=path.resolve(import.meta.dirname,'../..'),distribution=process.env.AGENTOPIA_TEST_DISTRIBUTION;
assert(/^AgentopiaRuntime-[0-9a-f-]{36}$/i.test(distribution??''),'Select the managed runtime explicitly.');
const running=execFileSync('wsl.exe',['--list','--running','--quiet'],{encoding:'buffer',windowsHide:true}).toString('utf16le').replace(/^\uFEFF/,'').split(/\r?\n/).map(name=>name.trim());
assert(running.includes(distribution),'The selected runtime must already be running. This check never starts it.');
assert(/^[A-Z]:\\/i.test(root),'This qualification requires the Windows source checkout.');
const linuxRoot='/mnt/'+root[0].toLowerCase()+root.slice(2).replaceAll('\\','/'),name='folder-migration-'+Date.now();
execFileSync('wsl.exe',['-d',distribution,'-u','agentopia','--exec','python3',linuxRoot+'/scripts/desktop/test-folder-receipt-migration.py',linuxRoot+'/.supabase/desktop-plugin-import/'+name],{stdio:'inherit',windowsHide:true,timeout:60000});
const evidence=JSON.parse(await readFile(path.join(root,'.supabase/desktop-plugin-import',name,'evidence.json'),'utf8'));
assert(evidence.success&&evidence.productionUnchanged&&evidence.disposableDatabaseRemoved);
