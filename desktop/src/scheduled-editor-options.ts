import type {ChatOptions,Project} from './contracts';
import type {TaskSnapshot} from './scheduled-task-contracts';
export type ScheduledProjectChoice={projectId:string;execution:'local'|'worktree'};

/** Saved single-project snapshots include automatically captured project files.
 * Show those through project selection; only explicit shared context remains in
 * the common selection when another project is added. */
export function scheduledEditorOptions(snapshot:TaskSnapshot,projects:Project[]):{options:ChatOptions;projects:ScheduledProjectChoice[]}{
 const selected=snapshot.targets?.map(target=>({projectId:target.projectId,execution:target.workspace?'worktree' as const:'local' as const}))??(snapshot.projectId?[{projectId:snapshot.projectId,execution:snapshot.workspace?'worktree' as const:'local' as const}]:[]);
 const project=projects.find(project=>project.id===snapshot.projectId),inherited=new Set(project?[...project.file_ids,...(project.reference_id?[project.reference_id]:[])]:[]);
 const options=structuredClone(snapshot.options);if(!snapshot.targets)options.files=options.files.filter(file=>!inherited.has(file));
 return {projects:selected,options};
}

export function scheduledEditorDestination(projects:ScheduledProjectChoice[],newChat:boolean,conversation:string){
 if(!newChat){if(!conversation)throw Error('Choose a chat for this scheduled follow-up.');return {conversationId:conversation,projectId:null};}
 if(projects.length>20||projects.some(project=>!project.projectId||!['local','worktree'].includes(project.execution))||new Set(projects.map(project=>project.projectId)).size!==projects.length)throw Error('Choose each scheduled project once, up to twenty projects.');
 if(projects.length===1)return {conversationId:null,projectId:projects[0].projectId,workspace:projects[0].execution};
 return {conversationId:null,projectId:null,...(projects.length?{projects:structuredClone(projects)}:{})};
}
