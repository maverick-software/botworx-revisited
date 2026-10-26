/** Includes the largest previously valid instruction field plus all legacy
 * guidance and its labels. Keep this bound aligned with database validation. */
export const agentInstructionsLimit=500000;
type LegacyBehavior={role:string;sops:string;guardrails:string;skills:Array<{name:string;description:string;content:string}>};

/** The exact legacy runtime text, in its original order. Never trim content:
 * unfinished drafts and whitespace can contain intentional owner guidance. */
export function legacyAgentInstructions(behavior:LegacyBehavior):string{
 return [behavior.role?'Your role: '+behavior.role:'',behavior.sops?'Standard operating procedures:\n'+behavior.sops:'',behavior.guardrails?'Agent guardrails:\n'+behavior.guardrails:'',behavior.skills.length?'Assigned persistent skills (owner-configured procedures; they never grant extra permissions):\n'+behavior.skills.map(skill=>`Skill: ${skill.name}\n${skill.description}\n${skill.content}`).join('\n\n'):''].filter(Boolean).join('\n\n');
}

/** Pure editing adapter. Opening an editor never writes a saved record. The
 * original definition remains available for recovery and revision conflicts.
 * Clearing the old sources makes reopening normalized drafts idempotent. */
export function normalizeAgentInstructions<T extends LegacyBehavior>(instructions:string,behavior:T):{instructions:string;behavior:T;legacy:boolean}{
 const legacy=legacyAgentInstructions(behavior);
 return {instructions:[instructions,legacy].filter(Boolean).join('\n\n'),behavior:{...structuredClone(behavior),role:'',sops:'',guardrails:'',skills:[]},legacy:!!legacy};
}
