const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {agentReference}=require(path.join(process.env.SYLVANA_AGENT_TEST_BUILD??path.resolve(__dirname,'../build'),'agent-reference.js'));
test('paged agent references preserve long receipts and remove credential fields before slicing',()=>{
 const output='x'.repeat(180000)+' END-OF-LONG-RECEIPT',value=agentReference({status:'completed',stdout:output,api_key:'private fixture',url:'https://fixture.invalid/?token=private-value&section=report',nested:[{text:'sk-proj-'+ 'A'.repeat(30)}]});
 assert.equal(value.stdout,output);assert(value.stdout.endsWith('END-OF-LONG-RECEIPT'));assert.equal(value.api_key,'[Protected credential]');assert(!JSON.stringify(value).includes('private-value'));assert(!JSON.stringify(value).includes('sk-proj-'));assert(value.url.includes('section=report'));
});
