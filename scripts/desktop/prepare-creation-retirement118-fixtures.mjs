import {readFileSync,writeFileSync} from 'node:fs';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('prepare retirement fixtures118');
function edit(p,a,b){let s=readFileSync(p,'utf8');if(!s.includes(a))throw Error(p+' missing '+a.slice(0,70));writeFileSync(p,s.replaceAll(a,b));}
for(const p of ['desktop/tests/creation-remote-resources.test.cjs','desktop/tests/creation-remote-fixture.cjs'])edit(p,"if(name==='desktop_creation_tool_scope')","if(name==='desktop_creation_retirement')return {data:state.retirement??null};if(name==='desktop_creation_tool_scope')");
edit('desktop/tests/preview-creation-resources.test.cjs','const db=activities(),events=[]','const db=Object.assign(activities(),{rpc:f.db.rpc}),events=[]');
edit('desktop/tests/creation-tool-scope.test.cjs',"name==='desktop_creation_tool_scope'?null:value","['desktop_creation_tool_scope','desktop_creation_retirement'].includes(name)?null:value");
edit('desktop/tests/creation-tool-scope.test.cjs',"calls[1].name,'desktop_write_creation_tool_scope'","calls[2].name,'desktop_write_creation_tool_scope'");
edit('desktop/tests/creation-tool-scope.test.cjs',"calls[1].args,{p_user","calls[2].args,{p_user");
edit('desktop/tests/creation-tool-scope.test.cjs','rpc:async()=>({data:value})',"rpc:async name=>({data:name==='desktop_creation_retirement'?null:value})");
for(const p of ['desktop/tests/creation-tool-scope.test.cjs','desktop/tests/agent-creation75.test.cjs','desktop/tests/agent-presentation-broker.test.cjs']){
 edit(p,'creationTools:{read:','creationTools:{active:async who=>assert.equal(who,owner),read:');
 if(p.includes('creation-tool-scope'))edit(p,'h.creationTools={read:','h.creationTools={active:async who=>assert.equal(who,owner),read:');
}
edit('desktop/tests/preview-broker-lifecycle.test.cjs','identity:async()=>({id:owner,admin:true}),','creationTools:{active:async who=>assert.equal(who,owner)},identity:async()=>({id:owner,admin:true}),');
let s=readFileSync('scripts/desktop/test-creation-context117-source.mjs','utf8').replace('source117-','source118-');s=s.replace("const e={success:false","files.push('desktop/src/creation-retirement.ts','desktop/database/0079-creation-retirement.sql','desktop/tests/creation-retirement.test.cjs');\r\nconst e={success:false");let marker=s.indexOf('e.focusedCases=');s=s.slice(0,marker)+s.slice(marker).replace("'desktop/tests/creation-tool-scope.test.cjs'","'desktop/tests/creation-tool-scope.test.cjs','desktop/tests/creation-retirement.test.cjs'");writeFileSync('scripts/desktop/test-creation-retirement118-source.mjs',s);
