const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {mkdtemp,readFile,writeFile,rm}=require('node:fs/promises'),{spawn}=require('node:child_process');
const {runCommand,validateCommand,redactCommandOutput,commandEnvironment}=require('../build/terminal-runner.js');
const script=path.resolve(__dirname,'../runtime/terminal.ps1'),quote=s=>"'"+s.replaceAll("'","''")+"'",alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const wait=async condition=>{for(let n=0;n<100;n++){if(await condition())return;await new Promise(r=>setTimeout(r,50));}throw new Error('Command process cleanup timed out.');};
test('Windows commands use their selected folder, preserve output and native exit code, and exclude provider environment values',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-command-'));try{
  const result=await runCommand(script,'Write-Output (Get-Location).Path;[Console]::Error.WriteLine("CHECK_STDERR");Write-Output "COMMAND_OK"',root,5000,new AbortController().signal);assert.equal(result.status,'completed',result.stderr);assert.equal(result.exitCode,0);assert(result.stdout.includes(root));assert(result.stdout.includes('COMMAND_OK'));assert(result.stderr.includes('CHECK_STDERR'));
  const failed=await runCommand(script,'cmd.exe /d /c exit 7',root,5000,new AbortController().signal);assert.equal(failed.status,'failed');assert.equal(failed.exitCode,7);
  const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='fixture-provider-environment-not-inherited';try{const clean=await runCommand(script,'if($env:OPENAI_API_KEY){throw "Unexpected inherited credential"};Write-Output "ENVIRONMENT_CLEAN"',root,5000,new AbortController().signal);assert.equal(clean.status,'completed');assert(clean.stdout.includes('ENVIRONMENT_CLEAN'));}finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
 }finally{assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});}
});
test('command validation rejects raw credentials; previews and stored output redact recognized secrets and bound output',async()=>{
 const key='sk-or-v1-'+('z'.repeat(50));assert.throws(()=>validateCommand('Write-Output '+key,1000),/credentials/);assert.throws(()=>validateCommand('ok',300001));assert.throws(()=>validateCommand('x\0y',1000));assert.equal(redactCommandOutput('Value '+key),'Value [credential redacted]');assert.equal(commandEnvironment({Path:'tools',SystemRoot:'Windows',OPENAI_API_KEY:key,SUPABASE_SERVICE_ROLE_KEY:'private'}).OPENAI_API_KEY,undefined);
 const result=await runCommand(script,'[Console]::Write("x"*250000)',os.tmpdir(),5000,new AbortController().signal);assert.equal(result.status,'completed',result.stderr);assert.equal(result.stdout.length,100000);assert(result.truncated);const unicode=await runCommand(script,'[Console]::Write("x"+[Char]::ConvertFromUtf32(128512)*50001)',os.tmpdir(),5000,new AbortController().signal);assert(unicode.truncated);assert(!/[\uD800-\uDBFF]$/.test(unicode.stdout));assert(unicode.stdout.length<=100000);
});
test('cancellation and time limits stop the command and normal spawned descendants',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-job-'));try{
  const marker=path.join(root,'worker.txt'),command='$taskWorker=Start-Process -FilePath (Join-Path $env:SystemRoot "System32/WindowsPowerShell/v1.0/powershell.exe") -ArgumentList "-NoProfile","-NonInteractive","-Command","Start-Sleep -Seconds 60" -WindowStyle Hidden -PassThru;$taskWorker.Id | Set-Content -LiteralPath '+quote(marker)+';Write-Output "CHILD_READY";Start-Sleep -Seconds 60',controller=new AbortController();let parent;
  const result=await runCommand(script,command,root,20000,controller.signal,row=>{if(row.stdout.includes('CHILD_READY'))controller.abort();},pid=>{parent=pid;});assert.equal(result.status,'cancelled');const worker=Number((await readFile(marker,'utf8')).trim());await wait(()=>!alive(parent)&&!alive(worker));
  let timedParent;const timed=await runCommand(script,'Start-Sleep -Seconds 60',root,1000,new AbortController().signal,undefined,pid=>{timedParent=pid;});assert.equal(timed.status,'timed_out');await wait(()=>!alive(timedParent));
 }finally{assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});}
});
test('loss of the Electron-owned pipe ends the Windows job after an abrupt parent-only termination',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-lease-'));let child;try{
  const fixture=path.join(root,'parent.cjs'),marker=path.join(root,'worker.txt');
  const command='$taskWorker=Start-Process -FilePath (Join-Path $env:SystemRoot "System32/WindowsPowerShell/v1.0/powershell.exe") -ArgumentList "-NoProfile","-NonInteractive","-Command","Start-Sleep -Seconds 60" -WindowStyle Hidden -PassThru;$taskWorker.Id | Set-Content -LiteralPath '+quote(marker)+';Write-Output "CHILD_READY";Start-Sleep -Seconds 60';
  await writeFile(fixture,'const {runCommand}=require('+JSON.stringify(path.resolve(__dirname,'../build/terminal-runner.js'))+');let pid;runCommand('+[JSON.stringify(script),JSON.stringify(command),JSON.stringify(root),'60000','new AbortController().signal','row=>{if(row.stdout.includes("CHILD_READY"))process.stdout.write(JSON.stringify({pid,ready:true})+"\\n");}','value=>{pid=value;}'].join(',')+');');
  child=spawn(process.execPath,[fixture],{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',data=>{output+=data;});await wait(()=>output.includes('"ready":true'));const parent=JSON.parse(output.trim().split('\n')[0]).pid,worker=Number((await readFile(marker,'utf8')).trim());child.kill('SIGKILL');await wait(()=>!alive(parent)&&!alive(worker));
 }finally{child?.kill('SIGKILL');assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});}
});
