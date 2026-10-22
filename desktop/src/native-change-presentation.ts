import {parsePatch,type StructuredPatch} from 'diff';
import {patchFilename,emptyPatchNames} from './git-patch-paths';
import type {NativeState} from './native-contracts';
export type NativeChange={key:string;threadId:string;turnId:string;path:string;from:string|null;to:string|null;beforeGit:string|null;afterGit:string|null;patch:string;parsed:StructuredPatch;absoluteFrom?:string;absoluteTo?:string;added:number|null;removed:number|null;issue?:string;parts?:NativeChange[]};
const slash=(value:string)=>value.replace(/\\/g,'/');
const matchPath=(paths:string[],name:string|null)=>{if(!name)return undefined;const exact=[...new Set(paths.filter(file=>slash(file).endsWith('/'+name)))];if(exact.length===1)return exact[0];if(exact.length)return undefined;const folded=[...new Set(paths.filter(file=>slash(file).toLowerCase().endsWith('/'+name.toLowerCase())))];return folded.length===1?folded[0]:undefined;};
function moveTarget(changes:{path:string;kind:any}[],source:string){let target=source;const visited=new Set<string>();for(let n=0;n<1000;n++){if(visited.has(target.toLowerCase()))break;visited.add(target.toLowerCase());const move=changes.find(change=>change.path===target&&change.kind.type==='update'&&change.kind.move_path)??changes.find(change=>change.path.toLowerCase()===target.toLowerCase()&&change.kind.type==='update'&&change.kind.move_path);if(!move)break;target=move.kind.move_path;}return target;}
export function nativeChanges(state:NativeState|undefined):NativeChange[]{
 if(!state)return [];const states=[state,...(state.reports??[]).map(report=>report.state)],result:NativeChange[]=[],seen=new Set<string>();
 for(const s of states)for(const aggregate of s.diffs??[]){
  const changes=s.items.filter(row=>row.threadId===aggregate.threadId&&row.turnId===aggregate.turnId&&row.completed&&row.item.type==='fileChange'&&row.item.status==='completed').flatMap(row=>row.item.type==='fileChange'?row.item.changes:[]);
  for(const block of aggregate.diff.split(/(?=^diff --git )/m).filter(block=>block.startsWith('diff --git '))){
   try{
    const preamble=block.split(/^@@ /m)[0],index=preamble.match(/^index ([0-9a-f]{40})\.\.([0-9a-f]{40})(?: [0-9]+)?$/m),initial=parsePatch(block)[0],old=preamble.match(/^--- (.*)$/m),next=preamble.match(/^\+\+\+ (.*)$/m);let from:string|null,to:string|null;
    if(old&&next){from=patchFilename(old[1].split('\t')[0],'a');to=patchFilename(next[1].split('\t')[0],'b');}
    else if(/^(new file mode|deleted file mode) /m.test(preamble)){const names=emptyPatchNames(block.split('\n')[0]);from=/^new file mode /m.test(preamble)?null:names.from;to=/^deleted file mode /m.test(preamble)?null:names.to;}
    else continue;
    const parsed:StructuredPatch={...initial,oldFileName:from===null?'/dev/null':'a/'+from,newFileName:to===null?'/dev/null':'b/'+to,oldHeader:'',newHeader:'',hunks:initial?.hunks??[]};
    const absoluteFrom=matchPath(changes.map(change=>change.path),from),absoluteTo=matchPath(changes.map(change=>change.kind.type==='update'&&change.kind.move_path?change.kind.move_path:change.path),to);
    // Codex's Windows aggregate can retain the original spelling on both Git
    // headers after a safe two-hop rename. Completed move paths retain the case.
    if(from&&to&&absoluteFrom&&absoluteTo&&absoluteFrom!==absoluteTo&&absoluteFrom.toLowerCase()===absoluteTo.toLowerCase()&&moveTarget(changes,absoluteFrom)===absoluteTo){from=slash(absoluteFrom).slice(-from.length);to=slash(absoluteTo).slice(-to.length);}
    const matched=(!from||!!absoluteFrom)&&(!to||!!absoluteTo);
    const key=JSON.stringify([aggregate.threadId,aggregate.turnId,from,to]);if(seen.has(key))continue;seen.add(key);
    const count=parsed.hunks.flatMap(h=>h.lines);
    result.push({key,threadId:aggregate.threadId,turnId:aggregate.turnId,path:from&&to&&from!==to?from+' → '+to:to??from??'File',from,to,beforeGit:index?.[1]??null,afterGit:index?.[2]??null,patch:block,parsed,absoluteFrom,absoluteTo,added:count.filter(line=>line.startsWith('+')).length,removed:count.filter(line=>line.startsWith('-')).length,issue:aggregate.truncated?'The aggregate patch was truncated.':!matched?'The patch does not match completed native file paths.':!index?'The patch does not include full content hashes.':undefined});
   }catch{/* The recorded work log retains unsupported patch formats. */}
  }
 }
 const grouped=new Set<string>(),combined:NativeChange[]=[];
 for(const deleted of result.filter(change=>change.from&&!change.to&&change.absoluteFrom)){
  const s=states.find(state=>state.items.some(item=>item.threadId===deleted.threadId&&item.turnId===deleted.turnId));if(!s)continue;
  let target=deleted.absoluteFrom!;const visited=new Set<string>();
  for(let depth=0;depth<1000;depth++){if(visited.has(target.toLowerCase()))break;visited.add(target.toLowerCase());const move=s.items.filter(item=>item.threadId===deleted.threadId&&item.turnId===deleted.turnId&&item.completed&&item.item.type==='fileChange'&&item.item.status==='completed').flatMap(item=>item.item.type==='fileChange'?item.item.changes:[]).find(change=>change.path.toLowerCase()===target.toLowerCase()&&change.kind.type==='update'&&change.kind.move_path);if(!move||move.kind.type!=='update'||!move.kind.move_path)break;target=move.kind.move_path;}
  const candidates=result.filter(change=>change.threadId===deleted.threadId&&change.turnId===deleted.turnId&&!change.from&&change.to&&change.absoluteTo?.toLowerCase()===target.toLowerCase()),added=candidates.find(change=>change.absoluteTo===target)??(candidates.length===1?candidates[0]:undefined);
  if(added&&target!==deleted.absoluteFrom!){grouped.add(deleted.key);grouped.add(added.key);combined.push({...added,key:JSON.stringify([deleted.threadId,deleted.turnId,deleted.from,added.to]),path:deleted.from+' → '+added.to,from:deleted.from,absoluteFrom:deleted.absoluteFrom,beforeGit:deleted.beforeGit,patch:deleted.patch+added.patch,added:deleted.beforeGit===added.afterGit?0:null,removed:deleted.beforeGit===added.afterGit?0:null,issue:deleted.issue??added.issue,parts:[deleted,added]});}
 }
 return [...result.filter(change=>!grouped.has(change.key)),...combined];
}
