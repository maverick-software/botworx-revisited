import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
desktopOperation('read actual image catalog through accepted58 routing code without credentials or generation');
const root=path.resolve(import.meta.dirname,'../..'),proof=await json((await json(path.join(root,'.supabase/desktop-parent-report-release58/current.json'))).proof);
const require=createRequire(import.meta.url),{imageModels}=require(path.join(proof.source,'build/image-models.js'));
assert.equal(await hash(path.join(proof.source,'build/image-models.js')),proof.compiled['image-models.js']);
const out=path.join(root,'.supabase/desktop-image-readiness59',String(Date.now()));await mkdir(out,{recursive:true});
const e={success:false,at:new Date().toISOString(),out,version:proof.version,sourceImageSha256:proof.imageSha256,credentialReads:0,imageRequests:0,productionWrites:0,calls:[]};
const fetcher=async(url,options)=>{assert.equal(url,'https://openrouter.ai/api/v1/images/models');assert(!options?.headers&&!options?.body);const response=await fetch(url,options);e.calls.push({url,status:response.status});if(response.ok)await writeFile(path.join(out,'public-catalog.json'),JSON.stringify(await response.clone().json(),null,2));return response;};
try{const models=await imageModels('openrouter',AbortSignal.timeout(25000),fetcher);assert(models.length);e.models=models;e.success=true;}catch(error){e.error=error.message;process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));await writeFile(path.join(root,'.supabase/desktop-image-readiness59/current.json'),JSON.stringify({out,evidence:path.join(out,'evidence.json')}));
console.log(JSON.stringify({success:e.success,out,calls:e.calls,models:e.models,error:e.error}));
