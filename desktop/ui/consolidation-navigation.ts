import type {AgentSection} from '../src/contracts';
/** Preserve old section IDs in stored drafts; only presentation chooses a current destination. */
export function canonicalAgentSection(section:AgentSection):AgentSection {
 if(section==='sources'||section==='channels')return 'mcp';
 if(section==='team'||section==='contacts')return 'capabilities';
 if(section==='schedule'||section==='workflows')return 'automations';
 return section;
}
