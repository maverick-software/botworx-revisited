import type {SupabaseClient} from '@supabase/supabase-js';
import type {WorkspaceFiles} from './workspace';
import type {PaneState} from './contracts';
import type {WorkspaceFileChange} from './file-operation-contracts';
import {applyWorkspaceChange} from './workspace-layout';
export async function reconcileWorkspaceLayout(db:SupabaseClient,files:WorkspaceFiles,owner:string,state:PaneState){
 const latest=await db.from('desktop_file_events').select('revision').eq('user_id',owner).order('revision',{ascending:false}).limit(1).maybeSingle();if(latest.error)throw new Error(latest.error.message);if((state.fileRevision??0)>Number(latest.data?.revision??0))throw new Error('This workspace revision is unavailable. Reload the workspace.');
 let next=state;
 for(;;){const result=await db.from('desktop_file_events').select('revision,change').eq('user_id',owner).gt('revision',next.fileRevision??0).order('revision').limit(500);if(result.error)throw new Error(result.error.message);const rows=result.data??[];if(!rows.length)return next;
  for(const row of rows){if(!Number.isSafeInteger(Number(row.revision))||Number(row.revision)<=0)throw new Error('Invalid workspace revision.');next=applyWorkspaceChange(next,files.list(owner),{...row.change,revision:Number(row.revision)} as WorkspaceFileChange);}
  if(rows.length<500)return next;
 }
}
