import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {closed} from './phased-backup-control.mjs';
import {assertNormalWindowsInstallContext} from './normal-windows-install-context.mjs';
desktopOperation('install verified43 after current recovery');
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04443'),json=async name=>JSON.parse(await readFile(path.join(candidate,name),'utf8')),hash=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
const promotion=await json('promotion-status.json'),release=await json('release-proof.json'),verified=await json('installer-verification/evidence.json');
assert(promotion.success&&promotion.version==='0.44.43'&&!promotion.installed&&promotion.phase==='recovery-verified-ready-for-installation');assert(release.success&&release.installerVerified&&verified.success&&verified.checks.length===7&&verified.installerSha256===promotion.installerSha256);await closed();await assertNormalWindowsInstallContext();
assert.equal(await hash(promotion.installer),promotion.installerSha256);assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.41/resources/app.asar'),'1d86280e08e52b7f789ca9ed388256057ed322991ca4c75110f533ed7ca6e146');assert.equal(await hash(path.join(promotion.backupOut,'evidence.json')),promotion.backupEvidenceSha256);
const operation={at:new Date().toISOString(),version:'0.44.43',installer:promotion.installer,installerSha256:promotion.installerSha256,backupOut:promotion.backupOut,phase:'started',authorization:'Current user request to make these five changes and standing instruction to perform necessary maintenance without repeated permission questions.',windowsUIInstallerAction:false,providerRequests:0};
const record=path.join(candidate,'installation-operation.json');await writeFile(record,JSON.stringify(operation,null,2),{flag:'wx'});
try{const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.AGENTOPIA_TEST_PROFILE;const result=await new Promise((resolve,reject)=>{const child=spawn(promotion.installer,['--silent'],{cwd:path.dirname(promotion.installer),env,windowsHide:true});operation.pid=child.pid;child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});Object.assign(operation,result,{finishedAt:new Date().toISOString()});assert.equal(result.code,0);assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.43/resources/app.asar'),promotion.imageSha256);operation.phase='installed-awaiting-ordinary-acceptance';operation.success=true;}
catch(error){operation.success=false;operation.error=error.stack;process.exitCode=1;}
await writeFile(record,JSON.stringify(operation,null,2));console.log(JSON.stringify(operation));
