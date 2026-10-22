const test=require('node:test'),assert=require('node:assert/strict');
const {pointerInput,dragSteps,pointImageHash,pointerDefinitions,scopedFrameDocuments}=require('../build/browser-pointer.js');
test('visual browser arguments retain exact image coordinates and reject invalid, unrelated and unbounded input',()=>{
 const base={tab_id:'tab',capture_id:'image'},click={...base,x:40.5,y:20,button:'right',click_count:2};assert.deepEqual(pointerInput('browser_click',click,100,80).points,[{x:40.5,y:20}]);
 for(const change of [{x:100},{x:-1},{y:NaN},{click_count:'2'},{button:'keyboard'},{extra:'ignored'}])assert.throws(()=>pointerInput('browser_click',{...click,...change},100,80));
 assert.throws(()=>pointerInput('browser_move',{...base,x:1,y:2,text:'secret'},100,80));assert.throws(()=>pointerInput('browser_scroll',{...base,x:1,y:1,delta_x:0,delta_y:0},100,80));assert.throws(()=>pointerInput('browser_scroll',{...base,x:1,y:1,delta_x:1601,delta_y:0},100,80));
 assert.deepEqual(pointerInput('browser_scroll',{...base,x:1,y:1,delta_x:-25,delta_y:50},100,80),{points:[{x:1,y:1}],button:'left',count:1,deltaX:-25,deltaY:50});assert.throws(()=>pointerInput('browser_drag',{...base,path:[{x:1,y:1}]},100,80));assert.throws(()=>pointerInput('browser_drag',{...base,path:Array.from({length:33},()=>({x:1,y:1}))},100,80));
 assert.equal(pointerDefinitions().length,4);
});
test('drag sampling preserves corners and bounds native input volume for complex paths',()=>{
 const path=[{x:1,y:1},{x:80,y:1},{x:80,y:70}],samples=dragSteps(path);assert.deepEqual(samples.at(-1),path.at(-1));assert(samples.some(p=>p.x===80&&p.y===1));assert(samples.every(p=>p.x>=1&&p.x<=80&&p.y>=1&&p.y<=70));
 const complex=dragSteps(Array.from({length:32},(_,i)=>({x:i%2?1599:0,y:i%3?1599:0})));assert(complex.length<=128);assert.deepEqual(dragSteps([{x:1,y:1},{x:1,y:1}]),[{x:1,y:1}]);
});
test('visual revalidation watches the relevant image region while unrelated animation remains usable',()=>{
 const width=200,height=100,bitmap=Buffer.alloc(width*height*4,255),initial={width,height,bitmap},points=[{x:40,y:50}],before=pointImageHash(initial,points),outside=Buffer.from(bitmap);outside[(50*width+150)*4]=0;assert.equal(pointImageHash({...initial,bitmap:outside},points),before);outside[(50*width+40)*4]=0;assert.notEqual(pointImageHash({...initial,bitmap:outside},points),before);assert.throws(()=>pointImageHash({...initial,bitmap:Buffer.alloc(2)},points));
});


test('frame checks retain target ancestry and descendants without blocking unrelated frame reloads',()=>{const old={main:{parent:null,stamp:'main'},target:{parent:'main',stamp:'target'},nested:{parent:'target',stamp:'nested'},other:{parent:'main',stamp:'old-ad'}},fresh={...old,other:{parent:'main',stamp:'new-ad'}};assert.deepEqual(scopedFrameDocuments(old,'main',['main']),scopedFrameDocuments(fresh,'main',['main']));assert.deepEqual(scopedFrameDocuments(old,'main',['target']),scopedFrameDocuments(fresh,'main',['target']));delete fresh.nested;assert.notDeepEqual(scopedFrameDocuments(old,'main',['target']),scopedFrameDocuments(fresh,'main',['target']));assert.throws(()=>scopedFrameDocuments(old,'main',['missing']));});
