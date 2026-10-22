import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('real Windows generated-image encryption and reopen verification');
const root=path.resolve(import.meta.dirname,'../..'),stage=path.resolve(process.argv[2]??''),base=path.join(root,'.supabase/desktop-image-generation');
assert(path.dirname(stage)===base&&/^source-check-\d{13}$/.test(path.basename(stage)));const proof=JSON.parse(await readFile(path.join(stage,'evidence.json'),'utf8'));assert(proof.success&&proof.testsPassed>=16);
for(const file of ['desktop/src/image-generation-contracts.ts','desktop/src/image-generation-transport.ts','desktop/src/generated-images.ts'])assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),proof.sourceHashes[file]);
const out=path.join(base,'windows-store-'+Date.now());await mkdir(out);await copyFile(import.meta.filename,path.join(out,'verification.mjs'));
const scope={owner:randomUUID(),id:randomUUID(),requestId:randomUUID(),conversationId:randomUUID(),nativeThreadId:randomUUID()},fixture=path.join(root,'.supabase/desktop-artifact-authoring/delivered-1792364116490/outputs/preview.png'),main=path.join(out,'main.cjs');
await writeFile(main,`const {app,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const out=${JSON.stringify(out)},scope=${JSON.stringify(scope)},mode=process.argv.at(-1);app.setPath('userData',path.join(out,'profile'));app.commandLine.appendSwitch('disable-background-networking');global.fetch=async()=>{throw Error('Network is disabled for this generated-image store test');};
app.whenReady().then(async()=>{const evidence={at:new Date().toISOString(),mode,success:false,actualWindowsCipher:true,actualElectronDecoder:true,productionProfileUsed:false,providerRequests:0};try{
 const {GeneratedImages}=require(${JSON.stringify(path.join(stage,'build/generated-images.js'))}),store=new GeneratedImages(path.join(out,'attachments/generated')),guard=async()=>{},file=path.join(out,'attachments/generated',scope.owner,scope.id+'.bin');
 if(mode==='write'){evidence.asset=await store.write(scope,fs.readFileSync(${JSON.stringify(fixture)}),guard);const encrypted=fs.readFileSync(file);assert(!encrypted.includes(Buffer.from(scope.requestId)));assert(!encrypted.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));evidence.encryptedBytes=encrypted.length;fs.writeFileSync(path.join(out,'asset.json'),JSON.stringify(evidence.asset));}
 const read=await store.read(scope,guard),size=nativeImage.createFromBuffer(read.bytes).getSize(),expected=JSON.parse(fs.readFileSync(path.join(out,'asset.json'),'utf8'));assert.deepEqual(read.asset,expected);assert.equal(size.width,640);assert.equal(size.height,360);assert.equal(createHash('sha256').update(read.bytes).digest('hex'),read.asset.sha256);await assert.rejects(store.read({...scope,conversationId:'11111111-1111-4111-8111-111111111111'},guard),/different request/);evidence.asset=read.asset;evidence.reopenedAndDecoded=true;evidence.wrongConversationRejected=true;evidence.success=true;
 }catch(error){evidence.error=error.message;}fs.writeFileSync(path.join(out,mode+'-evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));app.exit(evidence.success?0:1);});`);
const require=createRequire(import.meta.url),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const results=[];
for(const mode of ['write','read']){const code=await new Promise((resolve,reject)=>{const child=spawn(require('electron'),[main,mode],{cwd:root,env,windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>resolve(code??1));});const evidence=JSON.parse(await readFile(path.join(out,mode+'-evidence.json'),'utf8'));results.push(evidence);assert.equal(code,0,JSON.stringify(evidence));}
const evidence={at:new Date().toISOString(),success:results.every(result=>result.success),sourceQualification:stage,scope:'Actual Windows safeStorage and Electron raster decoding with generated fixture data; independent process reopen under its own encryption profile. Broker/database/UI integration and AI generation remain unverified.',results,providerRequests:0};await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:evidence.success,out,processes:results.length,providerRequests:0},null,2));
