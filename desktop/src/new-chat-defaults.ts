import type {ChatDraft} from './chat-drafts';
import type {ChatOptions,Provider,ProviderStatus} from './contracts';

// Initialization only: an explicit choice in a live or saved conversation wins.
export function newChatProvider(status:ProviderStatus|null,current?:Provider):Provider|undefined{
 if(status?.legalMode)return 'sylvana';
 if(status?.workspaceAI)return status.workspaceAI.provider;
 const available=(provider:Provider)=>provider==='sylvana'?!!status?.sylvana?.linked:provider==='openai-api'?!!status?.openaiApi:provider==='openai-oauth'?!!status?.chatgpt?.authorized||!!status?.chatgpt?.connectionIssue:!!status?.openrouter;
 if(status?.preferredProvider&&available(status.preferredProvider))return status.preferredProvider;
 if(status?.preferChatGPT!==false&&available('openai-oauth'))return 'openai-oauth';
 if(current&&available(current))return current;
 if(available('openai-api'))return 'openai-api';
 if(available('openrouter'))return 'openrouter';
 if(available('openai-oauth'))return 'openai-oauth';
 if(available('sylvana'))return 'sylvana';
 return current;
}
export function needsNewChatDefaults(scope:string,draft:ChatDraft|null|undefined){
 return scope.startsWith('new:')&&(!draft||!draft.text.trim()&&!draft.options.files.length&&!draft.options.sources?.length&&!draft.options.windows?.length&&!draft.options.skills?.length);
}
export type NewChatResolver=(options:ChatOptions)=>Promise<ChatOptions>;
