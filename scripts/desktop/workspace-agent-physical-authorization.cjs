const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');

// Consume only the protected, hash-verified physical snapshot made by the
// read-only WSL inspector. Reading the Windows profile path can be redirected.
function physicalAuthorization(root,id,now=Date.now()){
 assert(/^\d{13}$/.test(id??''),'Live qualification requires --authorization-snapshot with a physical inspection timestamp.');
 const directory=path.join(root,'.supabase/desktop-workspace-agents/authorization',id),snapshot=path.join(directory,'private-source');
 const exact=file=>{assert.equal(fs.realpathSync.native(file).toLowerCase(),path.resolve(file).toLowerCase(),'Physical authorization snapshot resolves elsewhere.');return fs.readFileSync(file);};
 const evidence=JSON.parse(exact(path.join(directory,'evidence.json'))),source=JSON.parse(exact(path.join(directory,'physical-source.json')));
 assert(evidence.success&&evidence.currentProfile&&evidence.physicalOrdinaryProfile&&evidence.readyForLiveQualification,'Physical authorization inspection is not ready for live qualification.');
 assert(evidence.renewalAttempted===false&&evidence.inferenceRequests===0&&evidence.canonicalCredentialWrites===0,'Authorization inspection must be read-only.');
 assert(source.physicalOrdinaryProfile===true&&source.sourceFilesUnchanged===true,'Physical source provenance is missing.');
 const age=now-Date.parse(evidence.at);assert(Number.isFinite(age)&&age>=0&&age<=300000,'Physical authorization inspection must be at most five minutes old.');
 assert(Number.isFinite(evidence.secondsRemaining)&&evidence.secondsRemaining-Math.ceil(age/1000)>600,'Physical access token expires too soon; renew only through the normal application.');
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(hash(exact(path.join(directory,'inspector.mjs'))),hash(fs.readFileSync(path.join(root,'scripts/desktop/inspect-physical-authorization.mjs'))),'Physical inspector changed; obtain a fresh inspection.');
 for(const name of ['Local State','credentials.bin']){const bytes=exact(path.join(snapshot,name)),record=source.files?.[name];assert(record&&bytes.length===record.bytes&&hash(bytes)===record.sha256,'Physical authorization snapshot changed: '+name);}
 return {snapshot,inspection:id,inspectedAt:evidence.at,secondsRemaining:evidence.secondsRemaining-Math.ceil(age/1000)};
}

module.exports={physicalAuthorization};
