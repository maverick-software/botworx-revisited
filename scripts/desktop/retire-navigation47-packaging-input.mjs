import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('retire only the verified completed47 generated packaging input');
const root=path.resolve(import.meta.dirname,'../..'),file=path.join(root,'.supabase/desktop-maintenance/navigation47-input/inspection.json'),hash=createHash('sha256').update(await readFile(file)).digest('hex');
const result=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/desktop/retire-navigation47-packaging-input.ps1'),'-InspectionSha256',hash],{cwd:root,windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:1024*1024});console.log(result.stdout.trim());
