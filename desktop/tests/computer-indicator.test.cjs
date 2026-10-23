const test=require('node:test'),assert=require('node:assert/strict');
const {ComputerIndicator,computerIndicatorHue,computerIndicatorHtml}=require('../build/computer-indicator.js');
function fixture({pending=false,failed=false}={}){
 const made=[],state={displays:[{id:1,bounds:{x:-800,y:0,width:800,height:600}},{id:2,bounds:{x:0,y:0,width:1000,height:800}}],cursor:{x:-400,y:250},changed:null,unwatched:false};let release;
 const host={displays:()=>state.displays,dip:box=>({x:box.left,y:box.top,width:box.width,height:box.height}),cursor:()=>state.cursor,watch:changed=>{state.changed=changed;return()=>state.unwatched=true;},create:bounds=>{const row={bounds,shown:0,destroyed:false,pointers:[]};made.push(row);return {ready:failed?Promise.reject(Error('renderer failed')):pending?new Promise(resolve=>release=resolve):Promise.resolve(),show:()=>row.shown++,bounds:next=>row.bounds=next,pointer:async(x,y,visible)=>row.pointers.push({x,y,visible}),destroy:()=>row.destroyed=true,alive:()=>!row.destroyed};}};
 return {made,state,host,release:()=>release?.(),indicator:new ComputerIndicator(host)};
}
const left={left:-700,top:100,width:600,height:400},right={left:100,top:100,width:600,height:400};
test('the presentation uses the requested purple hue without an input surface or remote content',()=>{
 assert.equal(computerIndicatorHue,'#a56bff');assert(computerIndicatorHtml.includes('pointer-events:none'));assert(computerIndicatorHtml.includes("default-src 'none'"));assert(!/<(?:input|button|iframe|script)\b|https?:/i.test(computerIndicatorHtml.replace('http://www.w3.org/2000/svg','')));
});
test('only the target monitor is outlined and the pointer uses that monitor’s local coordinates',async()=>{
 const f=fixture();try{await f.indicator.show('owner','request','reference',left);assert.equal(f.made.length,1);assert.deepEqual(f.made[0].bounds,f.state.displays[0].bounds);assert.equal(f.made[0].shown,1);assert.deepEqual(f.made[0].pointers.at(-1),{x:400,y:250,visible:true});await f.indicator.show('owner','request','reference',left);assert.equal(f.made.length,1);f.indicator.end('owner','request');assert(f.made[0].destroyed);}finally{f.indicator.dispose();}
});
test('ending or revoking one request preserves another monitor’s active request',async()=>{
 const f=fixture();try{await f.indicator.show('first','one','a',left);await f.indicator.show('second','two','b',right);assert.equal(f.made.length,2);f.indicator.end('second','one');assert(!f.made[0].destroyed);f.indicator.revoke('first','a');assert(f.made[0].destroyed);assert(!f.made[1].destroyed);f.indicator.stop('first');assert(!f.made[1].destroyed);f.indicator.stop('second');assert(f.made[1].destroyed);}finally{f.indicator.dispose();}
});
test('Stop during delayed renderer startup cannot reveal a late overlay',async()=>{
 const f=fixture({pending:true});try{const starting=f.indicator.show('owner','request','reference',left);f.indicator.stop();assert(f.made[0].destroyed);f.release();await starting;assert.equal(f.made[0].shown,0);}finally{f.indicator.dispose();}
});
test('a display move refreshes the layer and a cursor outside the selected monitor stays hidden',async()=>{
 const f=fixture();try{await f.indicator.show('owner','request','reference',left);f.state.cursor={x:200,y:200};await f.indicator.show('owner','request','reference',right);assert(f.made[0].destroyed);assert.equal(f.made[1].shown,1);assert(f.made[1].pointers.at(-1).visible);f.state.cursor={x:-400,y:200};await f.indicator.show('owner','request','reference',right);assert.equal(f.made[1].pointers.at(-1).visible,false);}finally{f.indicator.dispose();assert(f.state.unwatched);}
});
test('renderer failure and an unavailable target display leave no layer behind',async()=>{
 const f=fixture({failed:true});try{await assert.rejects(f.indicator.show('owner','request','reference',left),/renderer failed/);assert(f.made[0].destroyed);await assert.rejects(f.indicator.show('owner','other','reference',{left:10000,top:10000,width:100,height:100}),/display is unavailable/);}finally{f.indicator.dispose();}
});
