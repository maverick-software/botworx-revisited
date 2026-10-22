import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {json} from './phased-backup-control.mjs';
const root=path.resolve(import.meta.dirname,'../..'),folder=path.join(root,'scripts/desktop'),proof=await json((await json(path.join(root,'.supabase/desktop-image-attachment-release61/current.json'))).proof),base=await json(proof.acceptedBase);
assert(proof.version==='0.44.61'&&base.version==='0.44.60');
const names=['make-chrome-context-installer60.mjs','make-chrome-context-installer60-worker.mjs','verify-chrome-context-installer60.mjs','squirrel-stub-integrity60.mjs',...['run-normal-maintenance','maintenance-program-rollback','maintenance-update-command','test-maintenance-update-command','qualify-normal-maintenance','audit-agent-health','accept-installed','cleanup-obsolete-build'].map(name=>name+'60.mjs'),'normal-maintenance60-process.mjs','verify-maintenance-installation60.py','audit-agent-health60.py','remove-obsolete-build60.ps1'];
const mapping=Object.fromEntries(names.map(name=>[name,name.replace('chrome-context','image-attachment').replace('60','61')]));
for(const [name,suffix]of [['run-normal-maintenance','.mjs'],['normal-maintenance','-process.mjs'],['maintenance-program-rollback','.mjs'],['maintenance-update-command','.mjs'],['verify-maintenance-installation','.py']])mapping[name+'59'+suffix]=name+'60'+suffix;
Object.assign(mapping,{'0.44.59':'0.44.60','0.44.60':'0.44.61','0\\.44\\.59':'0\\.44\\.60','0\\.44\\.60':'0\\.44\\.61','desktop-chrome-context-release60':'desktop-image-attachment-release61','desktop-agent-health60':'desktop-agent-health61','current-update60':'current-update61','launcher-qualified59':'launcher-qualified60','launcher-qualified60':'launcher-qualified61','installer60-':'installer61-','update60-':'update61-','obsolete-build59':'obsolete-build60','Run-Agentopia-Chrome-Context-Update60.cmd':'Run-Agentopia-Image-Attachment-Update61.cmd'});
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pattern=new RegExp(Object.keys(mapping).sort((a,b)=>b.length-a.length).map(escaped).join('|'),'g'),advance=text=>text.replace(pattern,value=>mapping[value]).replaceAll('(?:59|60)','(?:60|61)').replaceAll('exact60','exact61');
const oldBase=await json(base.acceptedBase);
for(const [oldName,name]of names.map(name=>[name,mapping[name]])){let text=advance(await readFile(path.join(folder,oldName),'utf8'));if(name==='run-normal-maintenance61.mjs')text=text.replaceAll(oldBase.imageSha256,base.imageSha256);if(name==='audit-agent-health61.py')text=text.replaceAll(base.imageSha256,proof.imageSha256);await writeFile(path.join(folder,name),text);}
await writeFile(path.join(root,'Run-Agentopia-Image-Attachment-Update61.cmd'),advance(await readFile(path.join(root,'Run-Agentopia-Chrome-Context-Update60.cmd'),'utf8')));
console.log(JSON.stringify({helpers:names.length,currentImage:base.imageSha256,candidateImage:proof.imageSha256}));
