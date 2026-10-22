import type {ChatOptions} from './contracts';

export type TaskCadence={kind:'once';at:string}|{kind:'interval';minutes:number}|{kind:'cron';expression:string;timezone:string};
export type ScheduledTaskStatus='active'|'paused'|'completed'|'deleted';
export type ScheduledRunStatus='pending'|'starting'|'running'|'held'|'completed'|'failed'|'cancelled'|'skipped';
export type TaskFileBinding={id:string;path:string;kind:'file'|'folder'};
export type TaskWorkspace={
 mode:'worktree';source:TaskFileBinding;sourceFiles:TaskFileBinding[];commonDirectory:string;ref:string;
 resolved?:{runId:string;path:string;commit:string};
 sourceIdentity?:string;commonIdentity?:string;
};
export type TaskProjectTarget={projectId:string;projectRevision:number;files:TaskFileBinding[];workspace?:TaskWorkspace};
export type TaskSnapshot={
 name:string;instructions:string;agentId:string;agentRevision:number;projectId:string|null;projectRevision:number|null;
 conversationId:string|null;options:ChatOptions;files:TaskFileBinding[];notifications?:'important'|'all'|'off';
 targets?:TaskProjectTarget[];workspace?:TaskWorkspace;
};
export type ScheduledTask={
 id:string;owner:string;revision:number;status:ScheduledTaskStatus;cadence:TaskCadence;anchor:string;nextAt:string|null;
 missed:'skip'|'latest';snapshot:TaskSnapshot;note:string|null;legacyTaskId?:string;legacyUpdatedAt?:string;
};
export type LegacyScheduledTask={id:string;agentId:string;name:string;instructions:string;cadence:Extract<TaskCadence,{kind:'cron'}>;updatedAt:string};
export type ScheduledRun={
 id:string;taskId:string;owner:string;taskRevision:number;requestId:string;scheduledFor:string;trigger:'schedule'|'manual';
 status:ScheduledRunStatus;snapshot:TaskSnapshot;conversationId:string|null;error:string|null;unread:boolean;
 requestCreatedAt?:string|null;
 workspaceStartedAt?:string;
};
export type TaskRunOutcome={status:'completed';conversationId:string;error?:never}|{status:'failed'|'cancelled'|'held';conversationId?:string;error?:string};
export type TaskDispatchOutcome=TaskRunOutcome|{status:'queued'};
export class ScheduledTaskNotSubmitted extends Error{}

/** Every mutating operation must be atomic in its persistent implementation.
 * A failed or lost launch is held for inspection, never automatically retried. */
export interface ScheduledTaskStore{
 recover():Promise<void>;
 tasks(owner:string):Promise<ScheduledTask[]>;
 pending(owner:string):Promise<ScheduledRun[]>;
 stage(task:ScheduledTask,due:string,next:string|null,missed:boolean):Promise<ScheduledRun|null>;
 claim(owner:string,id:string):Promise<ScheduledRun|null>;
 defer(owner:string,id:string):Promise<boolean>;
 finish(owner:string,id:string,outcome:TaskRunOutcome):Promise<void>;
 hold(owner:string,id:string,reason:string):Promise<void>;
}
