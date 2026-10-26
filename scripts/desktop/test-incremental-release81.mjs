// Pure controls for the exact candidateA -> corrected candidateB qualification boundary.
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyIncrementalProofs,verifySourceCorrection,candidateAProof,candidateAProofSha256,candidateAImageSha256} from './qualify-incremental-release81.mjs';
const text=await readFile(candidateAProof,'utf8');assert.equal(createHash('sha256').update(text).digest('hex'),candidateAProofSha256);const prior=JSON.parse(text),priorCfg=JSON.parse(await readFile(prior.qaIntent,'utf8')),before=await readFile(path.join(prior.source,'ui/DesktopApp.tsx'),'utf8'),after=before.replace("setHandoff(false);setPluginSelection(null);setView('chat');","setHandoff(false);setPluginSelection(null);setSkillRows([]);setSkillSelection(null);setSkillDirty(false);setView('chat');"),next=structuredClone(prior),cfg=structuredClone(priorCfg);
next.out='F:/Agentopia/.supabase/desktop-release81/1792990000000';next.source=path.join(next.out,'source/desktop');next.sourceHashes['ui/DesktopApp.tsx']=createHash('sha256').update(after).digest('hex');const uiName=Object.keys(next.uiFiles).find(name=>name.endsWith('.js'));assert(uiName);next.uiFiles[uiName]='b'.repeat(64);next.resourceFiles['ui/'+uiName]=next.uiFiles[uiName];
cfg.out=path.join(next.out,'qa');cfg.program=path.join(cfg.out,'program');cfg.exe=path.join(cfg.program,'Agentopia.exe');cfg.assets=path.join(cfg.program,'resources/resources');
assert.equal(prior.imageSha256,candidateAImageSha256);verifySourceCorrection(before,after);assert.deepEqual(verifyIncrementalProofs(next,prior,cfg,priorCfg),['ui/DesktopApp.tsx']);
for(const change of [
 proof=>proof.resourceFiles['runtime/database_state.py']='changed',
 proof=>proof.resourceFiles['database/0088-unapproved.sql']='added',
 proof=>proof.programFiles['resources/app.asar']='changed',
 proof=>proof.compiled['broker.js']='changed',
 proof=>proof.productionDependencies.yaml.version='changed',
 proof=>proof.sourceHashes['ui/SkillsPage.tsx']='changed',
 proof=>proof.sourceHashes['src/broker.ts']='changed',
 proof=>proof.baseProof='F:/other/package-proof.json',
 proof=>proof.schema=89,
 proof=>proof.out=prior.out,
 proof=>proof.out='F:/other/1792990000000',
 proof=>proof.uiFiles=structuredClone(prior.uiFiles),
]){const altered=structuredClone(next);change(altered);assert.throws(()=>verifyIncrementalProofs(altered,prior,cfg,priorCfg));}
for(const source of [before,after+'\n// unrelated',after.replace('setSkillDirty(false);',''),after.replace('setSkillRows([]);','setSkillRows(stale);')])assert.throws(()=>verifySourceCorrection(before,source));
const wrongCfg=structuredClone(cfg);wrongCfg.instance='a91a4800-e08f-4440-a4ec-588762d01bfd';assert.throws(()=>verifyIncrementalProofs(next,prior,wrongCfg,priorCfg));
console.log(JSON.stringify({success:true,exactCandidateAProofPinned:true,onlyApprovedResetAccepted:true,unchangedRuntimeSqlDependenciesAndProgram:true,productionAccess:false,applicationStarted:false}));
