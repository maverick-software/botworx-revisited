/**
 * Artifact System Types
 * TypeScript interfaces for AI-generated artifacts
 */

export type ArtifactFileType =
  | 'txt'
  | 'md'
  | 'json'
  | 'html'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'css'
  | 'csv'
  | 'sql'
  | 'yaml'
  | 'xml'
  | 'bash'
  | 'shell'
  | 'dockerfile';

export type ArtifactStatus = 'active' | 'archived' | 'deleted';

export interface Artifact {
  id: string;
  user_id: string;
  agent_id: string;
  workspace_id?: string;
  conversation_session_id?: string;
  message_id?: string;
  
  title: string;
  file_type: ArtifactFileType;
  content: string;
  storage_path?: string;
  
  version: number;
  parent_artifact_id?: string;
  is_latest_version: boolean;
  
  description?: string;
  tags: string[];
  metadata: Record<string, any>;
  
  status: ArtifactStatus;
  
  view_count: number;
  download_count: number;
  last_viewed_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface ArtifactVersion {
  id: string;
  artifact_id: string;
  version_number: number;
  content: string;
  storage_path?: string;
  created_by: string;
  changes_note?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CreateArtifactParams {
  title: string;
  file_type: ArtifactFileType;
  content: string;
  description?: string;
  tags?: string[];
  conversation_session_id?: string;
  message_id?: string;
  workspace_id?: string;
}

export interface UpdateArtifactParams {
  artifact_id: string;
  content: string;
  title?: string;
  changes_note?: string;
}

export interface ListArtifactsParams {
  conversation_session_id?: string;
  file_type?: ArtifactFileType;
  limit?: number;
  offset?: number;
  include_archived?: boolean;
}

export interface ArtifactCardProps {
  artifact: Artifact;
  onOpenCanvas: (artifact: Artifact) => void;
  onDownload: (artifact: Artifact) => void;
  onDelete?: (artifact: Artifact) => void;
}

export interface CanvasModeProps {
  artifact: Artifact;
  onClose: () => void;
  onSave: (content: string, changes_note?: string) => Promise<void>;
  onDownload: (artifact: Artifact) => void;
  messages?: any[];
  agent?: any;
  user?: any;
  onSendMessage?: (message: string) => void;
  // AI processing state (for showing stages)
  thinkingMessageIndex?: number | null;
  currentProcessingDetails?: any;
  aiState?: any;
  currentTool?: any;
  processSteps?: any[];
}

// Monaco Editor language mapping
export const ARTIFACT_LANGUAGE_MAP: Record<ArtifactFileType, string> = {
  txt: 'plaintext',
  md: 'markdown',
  json: 'json',
  html: 'html',
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  css: 'css',
  csv: 'plaintext',
  sql: 'sql',
  yaml: 'yaml',
  xml: 'xml',
  bash: 'shell',
  shell: 'shell',
  dockerfile: 'dockerfile'
};

// File type icons (Lucide React icon names)
export const ARTIFACT_ICON_MAP: Record<ArtifactFileType, string> = {
  txt: 'FileText',
  md: 'FileText',
  json: 'Braces',
  html: 'Code2',
  javascript: 'FileCode',
  typescript: 'FileCode',
  python: 'FileCode',
  java: 'FileCode',
  css: 'Palette',
  csv: 'Table',
  sql: 'Database',
  yaml: 'FileCode',
  xml: 'Code2',
  bash: 'Terminal',
  shell: 'Terminal',
  dockerfile: 'Container'
};

// File type display names
export const ARTIFACT_TYPE_LABELS: Record<ArtifactFileType, string> = {
  txt: 'Text File',
  md: 'Markdown',
  json: 'JSON',
  html: 'HTML',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  css: 'CSS',
  csv: 'CSV',
  sql: 'SQL',
  yaml: 'YAML',
  xml: 'XML',
  bash: 'Bash Script',
  shell: 'Shell Script',
  dockerfile: 'Dockerfile'
};

// File extensions
export const ARTIFACT_EXTENSIONS: Record<ArtifactFileType, string> = {
  txt: '.txt',
  md: '.md',
  json: '.json',
  html: '.html',
  javascript: '.js',
  typescript: '.ts',
  python: '.py',
  java: '.java',
  css: '.css',
  csv: '.csv',
  sql: '.sql',
  yaml: '.yaml',
  xml: '.xml',
  bash: '.sh',
  shell: '.sh',
  dockerfile: 'Dockerfile'
};
