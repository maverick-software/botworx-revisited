const test=require('node:test'),assert=require('node:assert/strict');
const {sourceLocation,sourceFragment,sourceFragmentText,sourceLinkSuffix,goToSourceLocation}=require('../build/source-locations.js');
test('source references preserve line ranges and columns while ordinary document headings remain headings',()=>{
 for(const fragment of ['L18','L18C4','L18-L22','L18C4-L22C7'])assert.equal(sourceFragmentText(sourceFragment(fragment,true)),fragment);
 assert.equal(sourceFragment('details'),null);assert.equal(sourceFragment('l18'),null);assert.equal(sourceFragment('L0'),null);
 for(const fragment of ['L0','L2-L1','L1C0','L4C9-L4C2','L1000001','L1-Infinity','L2CNaN'])assert.throws(()=>sourceFragment(fragment,true));
 assert.throws(()=>sourceLocation({line:1,endLine:Infinity}));assert.throws(()=>sourceLocation({line:1.5,endLine:2}));
 assert.equal(sourceFragmentText(goToSourceLocation(' 18-22 ')),'L18-L22');assert.equal(sourceFragmentText(goToSourceLocation('18:4')),'L18C4');assert.equal(sourceFragmentText(goToSourceLocation('18')),'L18');assert.throws(()=>goToSourceLocation('word'));
});
test('source suffixes distinguish Windows drive letters, columns and ranges from web addresses and ports',()=>{
 assert.deepEqual(sourceLinkSuffix('C:\\project\\main.ts:18:4'),{href:'C:\\project\\main.ts',fragment:'L18C4'});assert.deepEqual(sourceLinkSuffix('src/main.ts:18-22'),{href:'src/main.ts',fragment:'L18-L22'});assert.deepEqual(sourceLinkSuffix('file:///C:/project/main.ts:18'),{href:'file:///C:/project/main.ts',fragment:'L18'});
 for(const href of ['https://example.com:8080/file#L2','http://127.0.0.1:57321','//example.com:443','C:\\project\\main.ts','main.ts#L18'])assert.deepEqual(sourceLinkSuffix(href),{href});assert.throws(()=>sourceLinkSuffix('main.ts:18#details'));assert.throws(()=>sourceLinkSuffix('main.ts:0'));assert.throws(()=>sourceLinkSuffix('main.ts:8-2'));
});
