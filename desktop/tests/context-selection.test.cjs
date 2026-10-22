const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const build=process.env.AGENTOPIA_AGENT_TEST_BUILD??path.resolve(__dirname,'../build');
const {contextMention,agentMention}=require(path.join(build,'agent-mention.js')),{ChatDrafts}=require(path.join(build,'chat-drafts.js'));
test('context queries include Unicode names and file paths while retaining code and quote exclusions',()=>{
 for(const query of ['résumé.pdf','folder/report.md','Search-app']){const text='Review @'+query,mention=contextMention(text,text.length);assert.equal(mention.query,query.toLowerCase());assert.equal(text.slice(mention.start,mention.end),'@'+query);}
 for(const text of ['mail@example.invalid','> @report.pdf','```js\n@report.pdf','Run `@report.pdf','\\@report.pdf'])assert.equal(contextMention(text,text.length),null);
 assert.equal(agentMention('@report.pdf',11),null);
});
const scope='conversation:11111111-1111-4111-8111-111111111111',id='mcp:22222222-2222-4222-8222-222222222222';
class Secrets{values=new Map();get(key){return this.values.get(key);}async set(key,value){this.values.set(key,structuredClone(value));}}
test('a selected plugin with an empty prompt survives persisted draft reopening for its account',async()=>{
 const secrets=new Secrets(),drafts=new ChatDrafts(secrets);await drafts.save('owner',scope,{text:'',options:{files:[],permission:'full',tools:[id]}});
 const reopened=new ChatDrafts(secrets);assert.deepEqual(reopened.get('owner',scope).options.tools,[id]);assert.equal(reopened.get('other',scope),null);
 await reopened.save('owner',scope,{text:'',options:{files:[],tools:[]}});assert.equal(reopened.get('owner',scope),null);
});
test('invalid plugin references cannot replace a saved unsent draft',async()=>{
 const drafts=new ChatDrafts(new Secrets());await drafts.save('owner',scope,{text:'Keep this draft',options:{files:[],tools:[id]}});
 await assert.rejects(async()=>drafts.save('owner',scope,{text:'',options:{files:[],tools:['unvalidated-source']}}),/available agent tools/);assert.equal(drafts.get('owner',scope).text,'Keep this draft');
});
