// Validate an observed OpenID ID-token renewal before applying frozen80 OAuth authority checks.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),frozen=require('./protected_settings_policy80.cjs');
const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item),same=(a,b)=>stable(a)===stable(b),object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function idTokenRenewal(before,after,publicJwks){
 assert(object(before)&&object(after)&&object(before.tokens)&&object(after.tokens));assert(before.discovery?.authorizationServerMetadata?.jwks_uri==='https://login.composio.dev/oauth2/jwks');
 assert(object(publicJwks)&&Array.isArray(publicJwks.keys)&&publicJwks.keys.length>0&&publicJwks.keys.length<=100,'Public Composio signing keys are required');
 const decode=token=>{assert(typeof token==='string'&&token.length>0&&token.length<128*1024);const parts=token.split('.');assert(parts.length===3&&parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part)));const header=JSON.parse(Buffer.from(parts[0],'base64url')),claims=JSON.parse(Buffer.from(parts[1],'base64url'));assert(object(header)&&object(claims)&&header.alg==='RS256'&&typeof header.kid==='string'&&header.kid.length>0);const keys=publicJwks.keys.filter(key=>key.kid===header.kid);assert.equal(keys.length,1,'Exactly one public signing key must match the ID-token header');const jwk=keys[0];assert(jwk.kty==='RSA'&&(!jwk.alg||jwk.alg==='RS256')&&(!jwk.use||jwk.use==='sig')&&!Object.hasOwn(jwk,'d'));const key=crypto.createPublicKey({key:jwk,format:'jwk'});assert(crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url')),'The Composio ID-token signature is invalid');return{header,claims};};
 const old=decode(before.tokens.id_token),next=decode(after.tokens.id_token);assert(same(old.header,next.header),'The ID-token header changed');const identity=claims=>Object.fromEntries(Object.entries(claims).filter(([key])=>key!=='iat'&&key!=='exp'));assert(same(identity(old.claims),identity(next.claims)),'ID-token identity or authority claims changed');
 const client=before.client?.client_id;assert(typeof client==='string'&&client.length>0&&old.claims.aud===client&&next.claims.aud===client);assert(old.claims.iss==='https://login.composio.dev'&&next.claims.iss===old.claims.iss);assert(typeof old.claims.sub==='string'&&old.claims.sub.length>0&&next.claims.sub===old.claims.sub);
 const now=Math.floor(Date.now()/1000);for(const claims of [old.claims,next.claims])assert(Number.isSafeInteger(claims.iat)&&Number.isSafeInteger(claims.exp)&&claims.iat>0&&claims.exp>claims.iat);assert(next.claims.iat>=old.claims.iat&&next.claims.iat<=now+60&&next.claims.exp>old.claims.exp&&next.claims.exp>now,'ID-token renewal times are invalid');return true;
}
function approvedChange(key,before,after,left,right,owner,publicJwks){
 if(typeof owner!=='string'||!/^[a-f0-9-]{36}$/.test(owner)||key!=='mcp-oauth-account:'+owner+':composio')return undefined;
 assert(object(before)&&object(after)&&object(before.tokens)&&object(after.tokens));
 if(before.tokens.id_token!==after.tokens.id_token){idTokenRenewal(before,after,publicJwks);const validationBefore={...before,tokens:{...before.tokens,id_token:after.tokens.id_token}};frozen.rotation(validationBefore,after);}else frozen.rotation(before,after);
 return 'verifiedComposioRotation';
}
module.exports={approvedChange,idTokenRenewal};
