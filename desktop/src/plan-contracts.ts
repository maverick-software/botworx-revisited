export type PlanStep={id:string;text:string;status:'pending'|'in_progress'|'completed'};
export type WorkspacePlan={id:string;user_id:string;conversation_id:string;agent_id:string;title:string;overview:string;steps:PlanStep[];revision:number;content_revision:number;approved_content_revision:number|null;updated_by:'user'|'agent';created_at:string;updated_at:string};
export type PlanDraft={version:number;baseRevision:number;title:string;overview:string;steps:PlanStep[]};
