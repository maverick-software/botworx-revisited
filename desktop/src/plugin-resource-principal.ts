import {creationResourcePrincipal,type CreationResourcePrincipal} from './creation-resource-principal';

export type PluginPrincipal=string|CreationResourcePrincipal;
export type PluginResourceBinding={agentId?:string;creation?:CreationResourcePrincipal};
export function pluginResource(binding:PluginResourceBinding):PluginPrincipal{
 if(binding.creation){if(binding.agentId!==undefined)throw Error('A plugin resource cannot combine a saved agent and a creation.');return creationResourcePrincipal(binding.creation);}
 if(typeof binding.agentId!=='string'||!binding.agentId)throw Error('Choose an owned plugin resource.');return binding.agentId;
}
export function pluginResourceBinding(target:PluginPrincipal):PluginResourceBinding{
 return typeof target==='string'?{agentId:target}:{creation:creationResourcePrincipal(target)};
}
export function pluginPrincipalIdentity(target:PluginPrincipal){return typeof target==='string'?target:creationResourcePrincipal(target);}
