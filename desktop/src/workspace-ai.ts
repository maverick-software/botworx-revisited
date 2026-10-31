export type WorkspaceAI={provider:'sylvana'|'openai-oauth'|'openai-api';models:Partial<Record<'openai-oauth'|'openai-api',{standard?:string;advanced?:string}>>;voice:{connection:'local'|'sylvana';tier:'standard'|'advanced';voice:string}};
export const defaultWorkspaceAI:WorkspaceAI={provider:'sylvana',models:{},voice:{connection:'sylvana',tier:'standard',voice:''}};
