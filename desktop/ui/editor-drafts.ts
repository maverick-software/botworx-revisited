export const pendingEditors=new Map<symbol,{owner:string;planId?:string;flush:()=>Promise<void>}>();
export async function flushEditors(owner:string,exceptPlan?:string){await Promise.all([...pendingEditors.values()].filter(item=>item.owner===owner&&(!exceptPlan||item.planId!==exceptPlan)).map(item=>item.flush()));}
