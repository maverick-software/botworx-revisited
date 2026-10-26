import type {ToolDefinition} from './tool-contracts';

/** Pinned local executors. A package cannot select an arbitrary host runtime. */
export const hostPluginFamilies={
 browser:{name:'agentopia-browser',title:'Browser',description:'Browse web pages in this chat’s Agentopia browser, with existing sharing and action reviews.'},
 files:{name:'agentopia-files-terminal',title:'Files & Terminal',description:'Read selected workspaces and run authorized commands or propose file changes under the current chat permissions.'},
 computer:{name:'agentopia-computer',title:'Computer Use',description:'Inspect and operate applications permitted by saved Computer use settings or legacy per-chat window shares, under current administrator and chat permissions.'},
 agents:{name:'agentopia-workspace-agents',title:'Workspace Agents',description:'Find and delegate to workspace agents, inspect chats and maintain authorized agent and project memory.'},
 documents:{name:'agentopia-documents-planning',title:'Documents & Planning',description:'Read agent documents and maintain this conversation’s reviewed plans.'},
 schedules:{name:'agentopia-schedules',title:'Automations',description:'Inspect and propose scheduled tasks with existing schedule reviews.'},
 composio:{name:'composio',title:'Composio API connections',description:'Use existing account-owned Composio project connections and their assigned apps.'}
} as const;
export type HostPluginFamily=keyof typeof hostPluginFamilies;
export const hostPluginNames=Object.values(hostPluginFamilies).map(row=>row.name);
export function hostToolPlugin(name:string):string|undefined{
 name=name.replace(/^(workspace|tools|planning)\./,'');
 if(name.startsWith('browser_'))return hostPluginFamilies.browser.name;
 if(name.startsWith('computer_'))return hostPluginFamilies.computer.name;
 if(['list_files','read_file','inspect_path','diagnose_workspace_access','write_file','manage_file','run_command','start_command','read_command','write_command','stop_command','list_command_sessions','start_terminal','write_terminal','read_terminal','stop_terminal'].includes(name))return hostPluginFamilies.files.name;
 if(['get_plan','set_plan','update_plan_progress'].includes(name)||name.includes('agent_document'))return hostPluginFamilies.documents.name;
 if(name.includes('scheduled_task'))return hostPluginFamilies.schedules.name;
 if(['list_agents','invoke_agent','list_agent_instances','read_agent_instance','search_agent_memory','read_agent_memory','save_agent_memory','list_chats','read_chat','search_chats','send_message_to_chat','search_project_chats','read_project_chat','search_project_memory','read_project_memory','save_project_memory'].includes(name))return hostPluginFamilies.agents.name;
 return;
}
export function ownHostTool(tool:ToolDefinition):ToolDefinition{const plugin=hostToolPlugin(tool.name);return plugin?{...tool,hostPlugins:[...new Set([...(tool.hostPlugins??[]),plugin])]}:tool;}
