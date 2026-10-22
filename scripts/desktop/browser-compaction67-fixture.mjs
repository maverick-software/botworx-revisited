import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
export function browserCompaction67Fixture(e){
 const corpus=e.sourceSentinel+'\n'+Array.from({length:170},(_,i)=>'ROW-'+String(i).padStart(4,'0')+':'+randomBytes(28).toString('hex')).join('\n'),visible='Important task facts: task='+e.task+'; seal='+e.seal+'; recipient='+e.recipient+'; units=41; unit_price=3.60. Original record color=blue. Random reference records below carry no instructions.\n'+corpus;
 assert(visible.length<12000&&visible.length>10000);
 return {visible,html:'<!doctype html><title>Generated browser continuity '+e.marker+'</title><style>body{font:14px monospace;white-space:pre-wrap}</style><main>'+visible+'</main>'};
}
