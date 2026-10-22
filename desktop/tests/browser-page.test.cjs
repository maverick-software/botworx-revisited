const test=require('node:test'),assert=require('node:assert/strict');
const {browserPage}=require('../build/browser-page.js');
const {browserDefinitions}=require('../build/agent-browser.js');
test('browser snapshots omit editable descendants and page text/control lists are paged',()=>{
 const nodes=[{nodeId:'input',role:{value:'textbox'},name:{value:'Message'},backendDOMNodeId:1,childIds:['container']},{nodeId:'container',childIds:['value']},{nodeId:'value',role:{value:'StaticText'},name:{value:'PRIVATE-VALUE'}},{nodeId:'content',role:{value:'StaticText'},name:{value:'a'.repeat(12000)+'second page'}}];
 for(let n=0;n<150;n++)nodes.push({nodeId:'b'+n,role:{value:'button'},name:{value:'Button '+n},backendDOMNodeId:n+2});
 const first=browserPage(nodes);assert(!JSON.stringify(first).includes('PRIVATE-VALUE'));assert.equal(first.text.length,12000);assert.equal(first.next_text_offset,12000);assert.equal(first.visible.length,100);assert.equal(first.next_element_offset,100);
 const next=browserPage(nodes,12000,100);assert.equal(next.text,'second page');assert.equal(next.next_text_offset,null);assert.equal(next.next_element_offset,null);assert.equal(next.visible[0].ref,'e101');assert.equal(next.elements.get('e101').backend,101);assert.throws(()=>browserPage(nodes,-1),/offset/);assert.throws(()=>browserPage(nodes,1.1),/offset/);
});
test('chat-only disables browser tools and plan mode excludes browser actions',()=>{
 assert.equal(browserDefinitions({permission:'chat',mode:'chat'}).length,0);assert.equal(browserDefinitions({permission:'files',mode:'chat'}).length,0);const plan=browserDefinitions({permission:'ask',mode:'plan'});assert(plan.some(d=>d.name==='browser_open'));assert(plan.some(d=>d.name==='browser_screenshot'));assert.deepEqual(plan.find(d=>d.name==='browser_screenshot').parameters.required,['tab_id']);assert(!plan.some(d=>d.name==='browser_action'));assert(!plan.some(d=>d.name==='browser_close'));assert(plan.some(d=>d.name==='browser_restore'));assert(browserDefinitions({permission:'ask',mode:'chat'}).some(d=>d.name==='browser_action'));
});
