const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {agentMention,removeAgentMention,resolveAgentAddress}=require(path.join(process.env.SYLVANA_AGENT_TEST_BUILD??path.resolve(__dirname,'../build'),'agent-mention.js'));
test('explicit mentions resolve at the caret while retaining message text',()=>{
 assert.deepEqual(agentMention('@Mi',3),{start:0,end:3,query:'mi'});
 const text='Please @Mira inspect this';const mention=agentMention(text,12);assert.deepEqual(mention,{start:7,end:12,query:'mira'});assert.equal(removeAgentMention(text,mention),'Please inspect this');
 assert.deepEqual(agentMention('Next\n@',6),{start:5,end:6,query:''});
});
test('sending an explicit leading address resolves a stable owned identity without picker interaction',()=>{
 const mira={id:'one',name:'Mira',handle:'mira-research',active:true},peers=[mira,{id:'two',name:'Other',handle:'other',active:true}];
 for(const text of ['@Mira hello','  @MIRA, check this','@mira-research: inspect','@Mira'])assert.equal(resolveAgentAddress(text,peers),mira);
 for(const text of ['mail@mira','`@Mira` hello','> @Mira hello','\\@Mira hello','Please ask @Mira','@mail.example'])assert.equal(resolveAgentAddress(text,peers),null);
 assert.throws(()=>resolveAgentAddress('@Unknown work',peers),/No active agent/);
 assert.throws(()=>resolveAgentAddress('@Mira work',[...peers,{id:'three',name:'Mira',active:true}]),/Several agents/);
 assert.equal(resolveAgentAddress('@mira-research work',[...peers,{id:'three',name:'Mira',active:true}]),mira);
});
test('email addresses, quoted text, escaped mentions and code never select agents',()=>{
 for(const text of ['mail@mira','> @Mira','  > quoted @Mira','```js\n@Mira','~~~text\n@Mira','Run `ask @Mira','Run ``ask ` @Mira','\\@Mira','@Mira:'])assert.equal(agentMention(text,text.length),null,text);
 const afterCode='```\n@inside\n```\n@Mira';assert(agentMention(afterCode,afterCode.length));
 assert.equal(agentMention('@Mira',-1),null);assert.equal(agentMention('@Mira',20),null);
});
