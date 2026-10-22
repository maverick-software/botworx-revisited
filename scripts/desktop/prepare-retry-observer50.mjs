import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
let source=await readFile(path.join(root,'scripts/desktop/launch-observed-profile-probe50.mjs'),'utf8');
assert(!source.includes("effective[1].splice"),'Regenerate the nonintrusive observer first.');
const marker="  if(expectedRuntime==='ready'){assert(status?.ready,JSON.stringify(status));";
assert(source.includes(marker));
const retry=`  evidence.startupAttempts=[status];
  for(let retry=1;expectedRuntime==='ready'&&status?.phase==='error'&&retry<=2;retry++){
   await writeFile(path.join(out,'startup-attempts.json'),JSON.stringify(evidence.startupAttempts,null,2));
   console.log(label+': clicking actual Try again '+retry);
   await page.getByRole('button',{name:'Try again',exact:true}).click();
   const retryDeadline=Date.now()+240000;let restarted=false,lastRetry;
   while(Date.now()<retryDeadline){
    status=await page.evaluate(()=>window.agentopia.call('runtime.status'));
    if(status.phase!=='error')restarted=true;
    if(status.phase!==lastRetry){lastRetry=status.phase;console.log(label+': retry '+retry+' '+status.phase);}
    if(status.ready||restarted&&status.phase==='error')break;
    await new Promise(resolve=>setTimeout(resolve,250));
   }
   evidence.startupAttempts.push(status);
  }
  await writeFile(path.join(out,'startup-attempts.json'),JSON.stringify(evidence.startupAttempts,null,2));
`;
source=source.replace(marker,retry+marker);
await writeFile(path.join(root,'scripts/desktop/launch-retry-profile-probe50.mjs'),source);
let test=await readFile(path.join(root,'scripts/desktop/observe-capability8-cold50.mjs'),'utf8');
test=test.replace("'./launch-observed-profile-probe50.mjs'","'./launch-retry-profile-probe50.mjs'").replaceAll('observed-cold-diagnostic.json','retry-cold-diagnostic.json');
await writeFile(path.join(root,'scripts/desktop/retry-capability8-cold50.mjs'),test);
console.log(JSON.stringify({success:true,diagnosticOnly:true,actualStartupRetryButton:true,maximumRetries:2}));
