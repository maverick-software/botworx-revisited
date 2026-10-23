const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {instructionAppMarkdown:format,instructionAppAt:parse,instructionAppReferences:references,instructionAppContext:context,withInstructionApps:expand}=require(path.join(process.env.AGENTOPIA_INSTRUCTION_BUILD||path.join(__dirname,'../build'),'instruction-app-references.js'));
const a='mcp:11111111-1111-4111-8111-111111111111',b='mcp:22222222-2222-4222-8222-222222222222';
const source=(id,name,enabled=true,ready=true)=>({id,name,enabled,ready,kind:id==='web_search'?'web':'mcp',detail:''});
const definitions=['mcp_search','mcp_call','web_search'].map(name=>({name,description:'',parameters:{}}));
test('app references preserve connection identity and escaped human names',()=>{
 for(const label of ['A &copy; & team','Microsoft Learn','A [team] (work) *plan*','Quotes " and \\ backslash','Receipt `code` | #notes']){const markdown=format(a,label),parsed=parse(markdown);assert.equal(parsed.id,a);assert.equal(parsed.label,label);assert.equal(parsed.to,markdown.length);}
 assert.throws(()=>format('https://untrusted.invalid','Unsafe'));assert.equal(parse('[@x](agentopia-app:javascript%3Aalert)'),undefined);
});
test('ordinary source positions survive multiple and repeated app references',()=>{
 const first=format(a,'Learn'),second=format(b,'Learn'),text='Use '+first+' then '+second+'. '+first;
 const rows=references(text);assert.equal(rows.length,3);for(const row of rows)assert.equal(text.slice(row.from,row.to),format(row.id,row.label));assert.deepEqual(rows.map(row=>row.id),[a,b,a]);
});
test('fenced, inline, indented, escaped and image literals stay ordinary text',()=>{
 const token=format(a,'Learn'),tick=String.fromCharCode(96);
 for(const text of [tick+token+tick,tick.repeat(3)+'md\n'+token+'\n'+tick.repeat(3),'~~~\n'+token+'\n~~~','    '+token,'\t'+token,'\\'+token,'!'+token])assert.deepEqual(references(text),[],text);
 assert.equal(references(tick.repeat(3)+'\n'+token+'\n'+tick.repeat(3)+'\n'+token).length,1);
});
test('same-name apps resolve only to the explicitly selected assigned identity',()=>{
 const text=format(a,'Same')+' '+format(b,'Same'),result=context(text,[source(a,'Renamed'),source(b,'Same')],definitions);
 assert(result.includes('"current_name":"Renamed"'));assert(result.includes('"connection_id":"11111111-1111-4111-8111-111111111111"'));assert(result.includes('"connection_id":"22222222-2222-4222-8222-222222222222"'));
});
test('unassigned, disconnected, disabled and omitted-tool references grant nothing',()=>{
 for(const sources of [[],[source(a,'Learn',false)],[source(a,'Learn',true,false)],[source(b,'Learn')]]){const result=context(format(a,'Learn'),sources,definitions);assert(result.includes('"status":"unavailable"'));assert(!result.includes('"connection_id"'));}
 for(const tools of [[],definitions.filter(row=>row.name!=='mcp_call')]){const result=context(format(a,'Learn'),[source(a,'Learn')],tools);assert(result.includes('"status":"unavailable"'));}
 const web=context(format('web_search','Web Search'),[source('web_search','Web Search')],[definitions[2]]);assert(web.includes('"tool":"web_search"'));
});
test('runtime expansion preserves stored source, other settings and actual tool grants',()=>{
 const agent={id:'agent',system_instructions:format(a,'Learn'),model:'current',settings:{enabled:true}},before=structuredClone(agent),sources=[source(a,'Learn')],tools=structuredClone(definitions);
 const result=expand(agent,sources,tools);assert.notEqual(result,agent);assert.deepEqual(agent,before);assert.deepEqual(tools,definitions);assert.equal(result.model,agent.model);assert(result.system_instructions.startsWith(agent.system_instructions));assert(result.system_instructions.includes('grant no access or permission'));
 const plain={system_instructions:'Ordinary instructions'};assert.equal(expand(plain,sources,tools),plain);
});
