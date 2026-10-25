import {desktopOperation} from './operation-lock.mjs';
desktopOperation('verify exact75 installed-updater command and scratch guards');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {maintenanceUpdateCommand,installedUpdater} from './maintenance-update-command75.mjs';
const pointer=JSON.parse(await readFile(path.resolve(import.meta.dirname,'../../.supabase/desktop-recovery75-release/current.json'),'utf8'));
const made=JSON.parse(await readFile(path.join(pointer.out,'installer-proof.json'),'utf8'));
const releaseDirectory=path.dirname(made.installer),temp='F:/Agentopia-Tmp/update75-1792533477586';
const command=maintenanceUpdateCommand({releaseDirectory,temp,environment:{ELECTRON_RUN_AS_NODE:'1',AGENTOPIA_TEST_PROFILE:'wrong',NODE_OPTIONS:'--inspect',KEEP:'yes'}});
assert.equal(command.exe,installedUpdater);assert.deepEqual(command.args,['--update',releaseDirectory.replaceAll('/','\\')]);
assert.equal(command.env.TEMP,temp.replaceAll('/','\\'));assert.equal(command.env.TMP,command.env.TEMP);assert.equal(command.env.SQUIRREL_TEMP,command.env.TEMP);assert.equal(command.env.KEEP,'yes');
for(const key of ['ELECTRON_RUN_AS_NODE','AGENTOPIA_TEST_PROFILE','NODE_OPTIONS'])assert(!Object.hasOwn(command.env,key));
for(const invalid of ['C:/temp','F:/Agentopia-Tmp/update75-../bad','F:/Agentopia-Tmp/update75-1792533477586/nested'])assert.throws(()=>maintenanceUpdateCommand({releaseDirectory,temp:invalid}));
assert.throws(()=>maintenanceUpdateCommand({releaseDirectory:'F:/other-release',temp}));
let checks=13;if(process.argv.includes('--preview76')){const next={version:'0.44.76',releaseDirectory:'F:/Agentopia-Tmp/i76-1792857583464/o',temp:'F:/Agentopia-Tmp/update76-1792857583464'},made=maintenanceUpdateCommand(next);assert.equal(made.exe,installedUpdater);assert.deepEqual(made.args,['--update',next.releaseDirectory.replaceAll('/','\\')]);assert.throws(()=>maintenanceUpdateCommand({...next,version:'0.44.75'}));assert.throws(()=>maintenanceUpdateCommand({...next,version:'0.44.77'}));assert.throws(()=>maintenanceUpdateCommand({...next,releaseDirectory}));assert.throws(()=>maintenanceUpdateCommand({...next,temp}));checks+=6;}
if(process.argv.includes('--release77')){const next={version:'0.44.77',releaseDirectory:'F:/Agentopia-Tmp/i77-1792893460888/o',temp:'F:/Agentopia-Tmp/update77-1792893460888'},made=maintenanceUpdateCommand(next);assert.equal(made.exe,installedUpdater);assert.deepEqual(made.args,['--update',next.releaseDirectory.replaceAll('/','\\')]);assert.throws(()=>maintenanceUpdateCommand({...next,version:'0.44.76'}));assert.throws(()=>maintenanceUpdateCommand({...next,version:'0.44.78'}));assert.throws(()=>maintenanceUpdateCommand({...next,releaseDirectory}));assert.throws(()=>maintenanceUpdateCommand({...next,temp}));checks+=6;}
console.log(JSON.stringify({success:true,checks,installedRootSelectedByUpdaterLocation:true,setupBootstrapperNotUsed:true,shortFDriveScratch:true}));
