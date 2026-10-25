export type NativeExecutionUsage={requests:string[];other:number};
/** Request reservations and their running workers describe the same work. */
export function executionLoad(reservations:Array<{kind:'chat'|'preview';id:string}>,native:Array<{kind:'chat'|'preview';usage:NativeExecutionUsage}>,exclude?:{kind:'chat'|'preview';id:string}){
 const keys=new Set(reservations.map(row=>row.kind+':'+row.id));let other=0;
 for(const row of native){for(const id of row.usage.requests)keys.add(row.kind+':'+id);other+=row.usage.other;}
 if(exclude)keys.delete(exclude.kind+':'+exclude.id);return keys.size+other;
}
