import {desktopOperation} from './operation-lock.mjs';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir,cp,rename,access} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

desktopOperation('history interface deployment');
const root=path.resolve(import.meta.dirname,'../..'),base=path.resolve(process.env.AGENTOPIA_LIVE_EXE??''),out=path.resolve(root,process.env.AGENTOPIA_HISTORY_DEPLOY_OUTPUT??'.supabase/desktop-history-finish/deployment');
assert(process.env.AGENTOPIA_LIVE_EXE&&path.basename(base)==='Agentopia.exe');
const live=execFileSync('powershell.exe',['-NoProfile','-Command',"@(Get-Process Agentopia -ErrorAction SilentlyContinue).Count"],{encoding:'utf8',windowsHide:true}).trim();
assert.equal(live,'0','Close Agentopia before replacing its interface.');
const resources=path.join(path.dirname(base),'resources/resources'),target=path.join(resources,'ui'),source=path.join(root,'desktop/resources/ui'),archive=path.join(path.dirname(base),'resources/app.asar');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function manifest(dir){const result={};for(const name of (await readdir(dir,{recursive:true,withFileTypes:true})).filter(e=>e.isFile()).map(e=>path.relative(dir,path.join(e.parentPath,e.name))).sort())result[name]=hash(await readFile(path.join(dir,name)));return result;}
await mkdir(out,{recursive:true});const evidence={at:new Date().toISOString(),executable:base,backendBefore:hash(await readFile(archive)),before:await manifest(target),source:await manifest(source)};
assert(evidence.source['index.html']);assert(Object.keys(evidence.source).length>=10);
const previous=path.join(resources,'ui-before-history-'+randomUUID()),next=path.join(resources,'ui-next-history-'+randomUUID());
for(const entry of [target,previous,next])assert(path.resolve(entry).startsWith(resources+path.sep));
try{await access(path.join(out,'evidence.json'));throw new Error('This deployment already has evidence. Inspect it before applying again.');}catch(error){if(error.code!=='ENOENT')throw error;}
await cp(target,path.join(out,'ui-before'),{recursive:true,errorOnExist:true,force:false});
await cp(source,next,{recursive:true});assert.deepEqual(await manifest(next),evidence.source);
await rename(target,previous);try{await rename(next,target);assert.deepEqual(await manifest(target),evidence.source);}catch(error){try{await rename(target,next+'-failed');}catch{}await rename(previous,target);throw error;}
evidence.backendAfter=hash(await readFile(archive));assert.equal(evidence.backendAfter,evidence.backendBefore);evidence.backup=previous;evidence.success=true;
await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
console.log('Updated the installed interface; previous UI backed up and backend archive unchanged.');
