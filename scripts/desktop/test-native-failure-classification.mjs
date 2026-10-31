import {test} from 'node:test';
import assert from 'node:assert/strict';
import failureModule from '../../desktop/build/native-execution-failure.js';
import jsonModule from '../../desktop/build/native-json.js';
const {nativeExecutionCancelled,preserveNativeFailure}=failureModule;
const {nativeJson}=jsonModule;

test('cleanup cannot relabel a saved-state failure as a user cancellation',()=>{
 const controller=new AbortController(),original=new Error('Saved state could not be written.');
 const failure=preserveNativeFailure(original,controller.signal);
 controller.abort(); // The harness stops outstanding native work in its finally block.
 assert.equal(nativeExecutionCancelled(failure,controller.signal),false);
 assert.equal(failure.message,original.message);
 assert.equal(failure.cause,original);
});
test('an explicit user stop and a native interrupted turn remain cancellations',()=>{
 const controller=new AbortController();controller.abort();
 assert.equal(nativeExecutionCancelled(preserveNativeFailure(new Error('Transport closed.'),controller.signal),controller.signal),true);
 const signal=new AbortController().signal,interrupted=new DOMException('Turn interrupted.','AbortError');
 assert.equal(preserveNativeFailure(interrupted,signal),interrupted);
 assert.equal(nativeExecutionCancelled(interrupted,signal),true);
});
test('native output snapshots replace database-invalid characters while preserving source receipts',()=>{
 const receipt={items:[{item:{type:'commandExecution',aggregatedOutput:'before\0after \uD800 \uDC00'}}]};
 const snapshot=nativeJson(receipt);
 assert.equal(snapshot.items[0].item.aggregatedOutput,'before�after � �');
 assert.equal(receipt.items[0].item.aggregatedOutput.includes('\0'),true);
});
test('valid Unicode and literal source escape sequences survive unchanged',()=>{
 const value={text:'Résumé — 📄 café 中文',code:String.raw`const zero="\u0000"`,nested:['done',null,7]};
 assert.deepEqual(nativeJson(value),value);
});
