const test=require('node:test'),assert=require('node:assert/strict');
const {StorageControl}=require('../build/storage-control.js');
const hold=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('close drains every admitted operation and refuses additional work until Keep open',async()=>{
 const control=new StorageControl(),first=hold(),second=hold();let closed=false,admitted=false;
 const a=control.run(()=>first.promise),b=control.run(()=>second.promise),close=control.beforeClose().then(()=>closed=true);
 assert.throws(()=>control.run(async()=>{admitted=true;}),/closing/);await tick();assert(!closed&&!admitted);
 first.resolve('first');assert.equal(await a,'first');await tick();assert(!closed);
 second.resolve('second');assert.equal(await b,'second');await close;assert(closed);
 assert.throws(()=>control.run(async()=>{}),/closing/);control.keepOpen();assert.equal(await control.run(async()=>42),42);
});
test('close settles rejected work without hiding the caller error or poisoning later work',async()=>{
 const control=new StorageControl(),pending=hold(),work=control.run(()=>pending.promise),failed=assert.rejects(work,/generated/),close=control.beforeClose();
 pending.reject(Error('generated'));await failed;await close;control.keepOpen();assert.equal(await control.run(async()=>7),7);
});
test('a synchronous operation failure is tracked and closing still completes',async()=>{
 const control=new StorageControl(),work=control.run(()=>{throw Error('generated sync failure');});
 await assert.rejects(work,/sync failure/);await control.beforeClose();
});
