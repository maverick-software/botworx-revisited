import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
import {seedValidation76} from './live-validation76-session.mjs';
desktopOperation('qualify selected-provider test leases with synthetic credentials and no network');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-endurance145/lease-qualification-'+Date.now());await mkdir(out,{recursive:true});
const owner=crypto.randomUUID(),pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),checks=[];
async function test({routerOnly=true,missingKey=false,unexpectedOAuth=false,expired=false,overlong=false,invalidExpiry=false,refresh=false}={}){
 const trial=path.join(out,crypto.randomUUID());await mkdir(trial);
 const connection={access_token:'synthetic-only',refresh_token:refresh?'synthetic-refresh':'',expires_at:Date.now()+3600000},values={connection:!routerOnly||unexpectedOAuth?connection:null,models:!routerOnly||unexpectedOAuth?[{id:'gpt-6.1-sol'}]:[],router:{key:missingKey?'':'synthetic-only'},routerModels:[{id:'openai/gpt-5-mini'}]},key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),bytes=Buffer.concat([cipher.update(JSON.stringify(values)),cipher.final()]);
 const lease=new Date(Date.now()+(expired?1:overlong?90:50)*60000).toISOString(),access={privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}),envelope:{key:crypto.publicEncrypt({key:pair.publicKey,oaepHash:'sha256'},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:bytes.toString('base64')},metadata:routerOnly?{routerOnly:true,leaseExpiresAt:invalidExpiry?'invalid':lease}:{}};
 const saved=new Map(),writes=[],s={},b={admin:{auth:{admin:{createUser:async()=>({data:{user:{id:owner}}})}},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:'synthetic-admin-role'}})})}),insert:async()=>({data:null})})},secrets:{get:key=>saved.get(key),setMany:async entries=>{writes.push(entries.map(([key])=>key));for(const[k,v]of entries)saved.set(k,v);}},call:async()=>{},terminal:{grant:async()=>{}},identity:async()=>({id:owner})};
 const context=vm.createContext({Buffer,Date,JSON,Number,Error,__coordination:{broker:b},__validation76:s,__durableProbeRequire:name=>name==='node:crypto'?crypto:assert.fail('Unexpected import')});
 const app={evaluate:(fn,arg)=>vm.runInContext('('+fn.toString()+')',context)(undefined,arg)},page={evaluate:async()=>({identity:{id:owner}})};
 try{await seedValidation76(app,page,trial,access);return {saved,writes,s};}catch(error){return {error,saved,writes,s};}
}
for(const[description,options]of [['missing Router key',{missingKey:true}],['unexpected OAuth in Router-only envelope',{unexpectedOAuth:true}],['expired lease',{expired:true}],['unbounded lease',{overlong:true}],['invalid lease timestamp',{invalidExpiry:true}],['copied refresh token',{routerOnly:false,refresh:true}]]){const r=await test(options);assert(r.error,description);assert.equal(r.writes.length,0,description+' must not install credentials');checks.push(description+' refused before credential writes.');}
const router=await test();assert(!router.error);assert(!router.saved.has('openai:'+owner));assert(!router.saved.has('models:openai-oauth:'+owner));assert.equal(router.saved.get('prefer-chatgpt:'+owner),false);assert(router.s.leaseActive&&router.s.expiresAt>Date.now()+49*60000);checks.push('Router-only lease installs no OAuth credential and has a bounded independent expiration.');
const both=await test({routerOnly:false});assert(!both.error);assert(both.saved.has('openai:'+owner));assert.equal(both.saved.get('prefer-chatgpt:'+owner),true);assert(both.s.leaseActive);checks.push('The existing two-provider behavior remains available by default.');
await writeFile(path.join(root,'.supabase/desktop-endurance145/lease-qualification.json'),JSON.stringify({success:true,at:new Date().toISOString(),checks,providerRequests:0,productionWrites:0,sourceSha256:await hash(path.join(root,'scripts/desktop/live-validation76-session.mjs'))},null,2));console.log(JSON.stringify({success:true,checks:checks.length,providerRequests:0}));
