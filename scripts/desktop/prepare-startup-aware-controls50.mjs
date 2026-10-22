import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');let source=await readFile(path.join(root,'scripts/desktop/qualify-agent-controls-04450.mjs'),'utf8');
const marker="await cp(path.join(proof.source,'tests'),tests,{recursive:true});";assert(source.includes(marker));
const adaptation=`
const fixtureSetupAdaptations={};
for(const [name,replacements]of Object.entries({
 'native-goals':[['Date.now()+12000','Date.now()+90000'],['controller.abort(),25000','controller.abort(),180000']],
 'goal-queue-native':[['n<800','n<6000'],['controller.abort()),25000','controller.abort()),180000']],
 'chat-delivery-broker':[['},25000)','},180000)']],
})){
 const file=path.join(tests,name+'.test.cjs'),original=await readFile(file,'utf8'),originalSha256=await hash(file);let revised=original;
 for(const [from,to]of replacements){assert(revised.includes(from),'Missing bounded fixture setup: '+name+' '+from);revised=revised.replaceAll(from,to);}
 await writeFile(file,revised);fixtureSetupAdaptations[name]={originalSha256,adaptedSha256:await hash(file),replacements,semanticAssertionsRetained:true};
}
await writeFile(path.join(out,'fixture-setup-adaptations.json'),JSON.stringify({reason:'Observed actual Codex initialization takes 22 to 38 seconds, exceeding the original 12-second observation and 25-second abort windows before controlled inference.',fixtureSetupAdaptations,productCodeChanged:false,diagnosticEvidence:['native-start-diagnostic/1792546694273','native-start-diagnostic/1792546821475','native-start-diagnostic/1792546869416','native-start-diagnostic/1792546993136']},null,2));
`;
source=source.replace(marker,marker+adaptation);
const report="const evidence={success:false,at:new Date().toISOString(),out,version:proof.version,";assert(source.includes(report));source=source.replace(report,"const evidence={fixtureSetupAdaptations,earlierInterruptedRun:'F:/Agentopia/.supabase/desktop-agent-controls50/1792545849293/evidence.json',success:false,at:new Date().toISOString(),out,version:proof.version,");
await writeFile(path.join(root,'scripts/desktop/qualify-agent-controls-04450-startup.mjs'),source);console.log(JSON.stringify({prepared:true,productRuntimeModified:false,fixtureSetupWindowsAdapted:true,semanticAssertionsRetained:true}));
