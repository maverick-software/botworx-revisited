import React from 'react';
import type {Agent} from '../src/contracts';
import {ToolConnections} from './ToolConnections';
import {ChatCapabilitySettings,type ChatSettingsContext} from './CapabilitySettings';
import {ToolConnectionsPanel} from './ProjectSettingsPanels';
import {ChatCoordinationSettings} from './ChatCoordinationSettings';
import type {Run} from './Panels';
export function ToolsPage({owner,agents,edit,run,plugins,context}:{owner:string;agents:Agent[];edit:(agent:Agent)=>void;run:Run;plugins:()=>void;context:ChatSettingsContext}){
 return <section className="library-page customize-page" aria-label="Tools"><h1>Tools</h1><p>Manage agent connections, credentials and chat capabilities.</p><ChatCapabilitySettings kind="chat-tools" context={context}/><ToolConnections agents={agents} edit={edit}/><ToolConnectionsPanel run={run} managePlugins={plugins}/><ChatCoordinationSettings owner={owner}/></section>;
}
export function SkillsPage({context}:{context:ChatSettingsContext}){return <section className="library-page customize-page" aria-label="Skills"><h1>Skills</h1><p>Choose instructions from assigned plugins and the current workspace.</p><ChatCapabilitySettings kind="skills" context={context}/></section>;}
