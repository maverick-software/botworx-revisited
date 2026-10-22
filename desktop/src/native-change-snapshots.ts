import {applyPatch,reversePatch} from 'diff';import {createHash} from 'node:crypto';
import type {NativeChange} from './native-change-presentation';
const zero='0'.repeat(40);
export const nativeBlobHash=(value:string)=>createHash('sha1').update('blob '+Buffer.byteLength(value,'utf8')+'\0').update(value,'utf8').digest('hex');
export function reconstructNativeChange(change:NativeChange,after:string|null):{before:string|null;after:string|null}{
 if(change.parts){const removed=reconstructNativeChange(change.parts[0],null),created=reconstructNativeChange(change.parts[1],after);return{before:removed.before,after:created.after};}
 if(change.issue||!change.beforeGit||!change.afterGit)throw new Error(change.issue??'The patch needs full native content hashes.');
 if(after===null?change.afterGit!==zero:nativeBlobHash(after)!==change.afterGit)throw new Error('The file changed after the native edit. Its newer contents were preserved.');
 if(after!==null&&(after.length>160000||after.includes('\0')))throw new Error('Native undo supports bounded UTF-8 text files.');
 for(const autoConvertLineEndings of [false,true]){
  const before=change.beforeGit===zero?null:applyPatch(after??'',reversePatch(change.parsed),{fuzzFactor:0,autoConvertLineEndings});
  if(before===false||before!==null&&(before.length>160000||before.includes('\0')||nativeBlobHash(before)!==change.beforeGit))continue;
  const forward=applyPatch(before??'',change.parsed,{fuzzFactor:0,autoConvertLineEndings});
  if(forward===false||forward!==(after??''))continue;
  return {before,after};
 }
 throw new Error('The original file could not be reconstructed with its recorded native hash. No undo snapshot was invented.');
}
