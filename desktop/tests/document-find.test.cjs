const test=require('node:test'),assert=require('node:assert/strict');
const {documentMatches}=require('../build/document-find.js');
test('document find matches literal syntax and returns offsets in the original Unicode text',()=>{
 const text='İ before Needle, needle, NEEDLE. café and 東京. literal .* [a]';
 for(const query of ['needle','café and 東京','.*','[a]']){const matches=documentMatches(text,query);assert.equal(matches.length,query==='needle'?3:1);for(const match of matches)assert.equal(text.slice(match.start,match.end).toLocaleLowerCase(),query.toLocaleLowerCase());}
 assert.equal(documentMatches(text,'Needle',true).length,1);assert.equal(documentMatches(text,'missing').length,0);assert.deepEqual(documentMatches(text,''),[]);assert.deepEqual(documentMatches(text,'a'.repeat(513)),[]);
});
test('document find retains all match positions for long extracted text',()=>{
 const text='needle\n'.repeat(2505),matches=documentMatches(text,'needle');assert.equal(matches.length,2505);assert.deepEqual(matches.at(-1),{start:2504*7,end:2504*7+6});
});
