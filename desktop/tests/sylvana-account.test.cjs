const test=require('node:test'),assert=require('node:assert/strict');
const {SylvanaAccount}=require('../build/sylvana-account.js');
const owner='12345678-1234-4123-8123-123456789abc';
function fixture(){const original={owner,email:'synthetic@sylvana.example',firmId:owner,firmName:'Synthetic',access_token:'original-access',refresh_token:'original-refresh',expires_at:0};const values=new Map([['sylvana-account:'+owner,original],['sylvana-legal:'+owner,true]]);const secrets={get:k=>values.get(k),set:async(k,v)=>{v===undefined?values.delete(k):values.set(k,v);},setMany:async rows=>{for(const [k,v]of rows)v===undefined?values.delete(k):values.set(k,v);}};return {original,values,secrets,account:new SylvanaAccount(secrets,async()=>{throw Error('No browser expected');})};}
test('Concurrent renewal shares one exchange and retains the verified owner',async()=>{
 const f=fixture();let exchanges=0;f.account.exchange=async()=>{exchanges++;await new Promise(resolve=>setTimeout(resolve,5));return {access_token:'renewed-access',refresh_token:'renewed-refresh',expires_in:3600};};f.account.identity=async(token,id)=>{assert.equal(id,owner);return owner;};
 const tokens=await Promise.all(Array.from({length:20},()=>f.account.access(owner)));assert(tokens.every(token=>token==='renewed-access'));assert.equal(exchanges,1);assert.equal(f.values.get('sylvana-account:'+owner).refresh_token,'renewed-refresh');
});
test('A failed encrypted publication preserves the received rotation and avoids exchanging the old refresh token twice',async()=>{
 const f=fixture();let exchanges=0,writes=0;f.account.exchange=async()=>{exchanges++;return {access_token:'renewed-access',refresh_token:'renewed-refresh',expires_in:3600};};f.account.identity=async()=>owner;const write=f.secrets.set;f.secrets.set=async(...args)=>{if(++writes===1)throw Error('Controlled storage failure');return write(...args);};
 await assert.rejects(f.account.access(owner),/storage failure/);assert.equal(f.values.get('sylvana-account:'+owner),f.original);assert.equal(await f.account.access(owner),'renewed-access');assert.equal(exchanges,1);
});
test('Offline sign-out clears usable local access and retains only the pending revocation until it can finish',async()=>{
 const f=fixture();f.original.expires_at=Date.now()+3600000;f.account.request=async()=>{throw Error('Controlled offline state');};await assert.rejects(f.account.disconnect(owner),/offline/);assert(!f.account.status(owner).linked);assert(f.account.legal(owner));assert(f.values.has('sylvana-logout:'+owner));await assert.rejects(f.account.access(owner),/Connect your Sylvana/);
 f.account.request=async()=>new Response();await f.account.finishLogout(owner);assert(!f.values.has('sylvana-logout:'+owner));
});
test('Already invalid refresh grants finish pending sign-out without blocking the next sign-in',async()=>{
 const f=fixture();f.account.exchange=async()=>{throw Object.assign(Error('Revoked grant'),{status:400,code:'invalid_grant'});};await f.account.disconnect(owner);assert(!f.account.status(owner).linked);assert(!f.values.has('sylvana-logout:'+owner));assert(f.account.legal(owner));
});
test('Legal policy withholds image credentials and enablement while retaining the saved connection',async()=>{
 const {ImageConnections}=require('../build/image-connections.js'),f=fixture();
 const saved={enabled:true,provider:'openrouter',model:'synthetic/model'};f.values.set('image-generation:'+owner,saved);f.values.set('openrouter',{key:'synthetic-image-key'});
 const images=new ImageConnections(f.secrets);assert.equal(images.connection(owner).enabled,false);assert.equal(images.credential(owner,'openrouter'),undefined);assert.equal(f.values.get('image-generation:'+owner),saved);
 await assert.rejects(images.save(owner,saved),/disabled/);assert.equal(f.values.get('openrouter').key,'synthetic-image-key');
});
