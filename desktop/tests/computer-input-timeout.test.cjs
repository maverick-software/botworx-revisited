const test=require('node:test'),assert=require('node:assert/strict');
const {computerRequestTimeout}=require('../build/computer-client.js');
test('paced typing has enough bounded transport time while ordinary operations keep their short deadline',()=>{
 assert.equal(computerRequestTimeout('windows',{}),12000);
 assert.equal(computerRequestTimeout('action',{kind:'key',text:'x'.repeat(2000)}),12000);
 const maximum=computerRequestTimeout('action',{kind:'type',text:'x'.repeat(2000)});
 assert(maximum>=2000*25+12000&&maximum<=360000);
 assert(computerRequestTimeout('action',{kind:'type',text:'short'})<maximum);
 assert.equal(computerRequestTimeout('action',{kind:'type',text:'short'},maximum),maximum);
});
test('malformed or over-limit input cannot extend the helper transport deadline',()=>{
 for(const args of[null,{},[],{kind:'type',text:''},{kind:'type',text:[]},{kind:'type',text:'x'.repeat(2001)},{kind:'type',text:'x'.repeat(1000000)}])assert.equal(computerRequestTimeout('action',args),12000);
 assert.equal(computerRequestTimeout('snapshot',{kind:'type',text:'x'.repeat(2000)}),12000);
});
