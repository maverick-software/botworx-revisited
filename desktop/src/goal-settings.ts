import type {Goal} from './contracts';

export const maximumGoalTurns=1000;
export type GoalLimits={maxTurns:number|null;tokenBudget:number|null};
export type GoalInput=GoalLimits&{id?:string;objective:string;start:boolean};
export function goalLimits(value:{maxTurns?:unknown;tokenBudget?:unknown}):GoalLimits{
 const turns=value.maxTurns===undefined?null:value.maxTurns,budget=value.tokenBudget??null;
 if(turns!==null&&(!Number.isSafeInteger(turns)||Number(turns)<1||Number(turns)>maximumGoalTurns))throw new Error('Choose no turn limit, or a whole number from 1 to '+maximumGoalTurns+'.');
 if(budget!==null&&(!Number.isSafeInteger(budget)||Number(budget)<1))throw new Error('Enter a positive whole-number token budget, or leave it unlimited.');
 return {maxTurns:turns as number|null,tokenBudget:budget as number|null};
}
export function goalHasTurns(goal:Pick<Goal,'max_turns'|'turns_used'>){return goal.max_turns===null||goal.turns_used<goal.max_turns;}
export function goalTurnLabel(goal:Pick<Goal,'max_turns'|'turns_used'>){return goal.max_turns===null?goal.turns_used+' turns · No turn limit':goal.turns_used+'/'+goal.max_turns+' turns';}
