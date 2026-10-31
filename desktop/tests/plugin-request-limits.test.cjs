const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {desktopRequestLimit}=require(path.join(process.env.SYLVANA_PREVIEW_BUILD,'request-limits.js'));
test('the existing maximum package and its digest fit every plugin package desktop action',()=>{
 const pkg={manifest:{name:'large-reviewed-package'},files:{'skills/test/SKILL.md':''}},max=4*1024**2;pkg.files['skills/test/SKILL.md']='a'.repeat(max-JSON.stringify(pkg).length);assert.equal(JSON.stringify(pkg).length,max);
 const args={package:pkg,digest:'a'.repeat(64)};
 for(const action of ['plugins.validate','plugins.install','plugins.reviewUpdate','plugins.update'])assert(JSON.stringify(args).length<=desktopRequestLimit(action),action);
});
test('unrelated plugin actions retain the ordinary bounded message limit',()=>{
 for(const action of ['plugins.list','plugins.assign','plugins.enable','plugins.remove','plugins.validateExtra'])assert.equal(desktopRequestLimit(action),200000);
});
