// Use the normal main-window close request; never force an agent or app to stop.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {hash,closed} from './phased-backup-control.mjs';
export async function closeOrdinaryAgentopia({expectedExe,expectedImageSha256,ensureIdle}){
 const exec=promisify(execFile),command=async text=>(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',text],{windowsHide:true,encoding:'utf8',timeout:55000})).stdout.trim();
 assert.equal(path.resolve(expectedExe).toLowerCase(),path.resolve('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.72/Agentopia.exe').toLowerCase());assert.equal(await hash(path.join(path.dirname(expectedExe),'resources/app.asar')),expectedImageSha256);
 const output=await command("@(Get-CimInstance Win32_Process -Filter \"Name='Agentopia.exe'\" | Where-Object { $_.CommandLine -notmatch '--type=' } | Select-Object ProcessId,ExecutablePath,CommandLine) | ConvertTo-Json -Compress");
 const observed=output?JSON.parse(output):[],rows=Array.isArray(observed)?observed:[observed];if(!rows.length){await closed();return {success:true,alreadyClosed:true,forcedTermination:false};}assert.equal(rows.length,1,'Inspect other Agentopia main processes before maintenance');const process=rows[0];assert.equal(path.resolve(process.ExecutablePath).toLowerCase(),path.resolve(expectedExe).toLowerCase());assert(!/--inspect|--remote-debugging/.test(process.CommandLine));assert.equal(typeof ensureIdle,'function');await ensureIdle();
 const result=JSON.parse(await command("$ErrorActionPreference='Stop'; $p=Get-Process -Id "+Number(process.ProcessId)+"; if($p.Path -ne '"+expectedExe.replaceAll("'","''")+"'){throw 'The main process changed'}; if($p.MainWindowHandle -eq 0){throw 'No normal main window'}; $accepted=$p.CloseMainWindow(); if(-not $accepted){throw 'Normal close was refused'}; $exited=$p.WaitForExit(45000); @{pid=$p.Id;normalCloseAccepted=$accepted;exited=$exited;forcedTermination=$false}|ConvertTo-Json -Compress"));assert(result.exited&&result.normalCloseAccepted);await closed();return {success:true,...result};
}

export async function reopenOrdinaryAgentopia({expectedExe,expectedImageSha256}){
 const exec=promisify(execFile),exe=path.resolve(expectedExe);assert(/^C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-0\.44\.(?:72|73)\\Agentopia\.exe$/i.test(exe));await closed();assert.equal(await hash(path.join(path.dirname(exe),'resources/app.asar')),expectedImageSha256);
 try{await exec('explorer.exe',[exe],{windowsHide:true,timeout:15000});}catch(error){if(error.code!==1)throw error;}
 const deadline=Date.now()+45000;while(Date.now()<deadline){const observed=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$rows=@(Get-CimInstance Win32_Process -Filter \"Name='Agentopia.exe'\" | Where-Object { $_.CommandLine -notmatch '--type=' }); if($rows.Count -eq 1){$main=Get-Process -Id $rows[0].ProcessId; @{pid=$main.Id;exe=$rows[0].ExecutablePath;debug=($rows[0].CommandLine -match '--inspect|--remote-debugging');window=($main.MainWindowHandle -ne 0);responding=$main.Responding}|ConvertTo-Json -Compress}"],{windowsHide:true,encoding:'utf8',timeout:15000})).stdout.trim();if(observed){const result=JSON.parse(observed);assert.equal(path.resolve(result.exe).toLowerCase(),exe.toLowerCase());assert(!result.debug);if(result.window&&result.responding)return {success:true,...result,visualAccountAcceptancePending:true};}await new Promise(resolve=>setTimeout(resolve,500));}throw Error('The ordinary application did not expose a responding main window; inspect its existing process before another launch');
}
