import type {Agent} from './contracts';

// The existing owner-scoped creation receipt makes retries and concurrent starts
// return the same assistant without overwriting later account configuration.
export const defaultAssistantCreation='9c3fc705-595d-48f3-8ae2-40bd2e37b0dc';
export const defaultAssistantInput={
 p_creation:defaultAssistantCreation,p_name:'Sylvana',
 p_description:'Your default Sylvana assistant. Custom agents are optional.',
 p_instructions:'You are Sylvana, a helpful assistant for this law firm. Help with questions, drafting, analysis, planning and everyday work. Be clear about uncertainty and check important claims. Never invent facts, citations or completed actions. Follow the user\'s instructions and the workspace\'s permissions and privacy rules.',
 p_provider:'sylvana',p_model:'standard',
 p_appearance:{version:1,icon:'bot',color:'blue',starters:null},p_avatar:null,
};
export function defaultChatAgent(agents:Agent[]){return agents.find(a=>a.builtin&&a.active!==false)??agents.find(a=>a.active!==false)??null;}
export function newChatScope(agent:Agent|null,project?:string|null){return 'new:'+(agent?.builtin?'unassigned':agent?.id??'unassigned')+':'+(project??'home');}
