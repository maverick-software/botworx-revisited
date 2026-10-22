import type {Agent,ChatOptions,Model} from '../src/contracts';

/** An agent's saved connection is explicit; account-wide composer choices are defaults. */
export function agentAutomationOptions(agent:Agent,defaults:ChatOptions,models:Model[]):ChatOptions{
 const normalize=(name:string)=>name.startsWith('openai/')?name.slice(7):name;
 const model=models.find(row=>normalize(row.id)===normalize(agent.model));
 if(!model)throw Error('This agent’s saved model is unavailable. Edit the agent to choose an available model before adding an automation.');
 const thinking=defaults.provider===agent.provider&&model.thinking?.includes(defaults.thinking)?defaults.thinking:'default';
 return {...defaults,provider:agent.provider,model:model.id,thinking,harness:'codex',files:[],goalId:undefined,sources:undefined,windows:undefined};
}
