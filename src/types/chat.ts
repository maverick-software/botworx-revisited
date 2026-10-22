import type { Database } from './database.types';
import type { AIState, ToolExecutionStatus } from '../components/AIThinkingIndicator';
import type { Message } from './index';

export type Agent = Database['public']['Tables']['agents']['Row'];
export type ChatMessage = Message; // Alias for compatibility

export interface ChatState {
  agent: Agent | null;
  messages: Message[];
  input: string;
  loading: boolean;
  sending: boolean;
  error: string | null;
  isHistoryLoading: boolean;
  selectedConversationId: string | null;
  isCreatingNewConversation: boolean;
}

export interface ModalState {
  showTeamAssignmentModal: boolean;
  showAboutMeModal: boolean;
  showHowIThinkModal: boolean;
  showWhatIKnowModal: boolean;
  showToolsModal: boolean;
  showChannelsModal: boolean;
  showTasksModal: boolean;
  showHistoryModal: boolean;
  showProcessModal: boolean;
  showAgentSettingsModal: boolean;
  agentSettingsInitialTab: 'identity' | 'behavior' | 'memory' | 'reasoning';
}

export interface FileUploadState {
  uploading: boolean;
  uploadProgress: {[key: string]: number};
}

export interface AIProcessingState {
  aiState: AIState | null;
  currentTool: ToolExecutionStatus | null;
  showAIIndicator: boolean;
  processSteps: Array<{
    state: AIState;
    label: string;
    duration?: number;
    details?: string;
    response?: string;
    toolCall?: string;
    toolResult?: any;
    completed: boolean;
    startTime?: Date;
  }>;
  thinkingMessageIndex: number | null;
  currentProcessingDetails: any;
}

export interface AgentSettings {
  reasoningEnabled: boolean;
  webSearchEnabled: boolean;
  hasWebSearchCredentials: boolean;
}

export interface ChatHandlers {
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleFileUpload: (files: FileList, uploadType: 'document' | 'image') => Promise<void>;
  handleRenameConversation: () => Promise<void>;
  handleArchiveConversation: () => Promise<void>;
  handleShareConversation: () => Promise<void>;
  adjustTextareaHeight: () => void;
}

export interface ChatRefs {
  messagesEndRef: React.RefObject<HTMLDivElement>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  fetchAgentAttempts: React.MutableRefObject<number>;
  isMounted: React.MutableRefObject<boolean>;
  fetchInProgress: React.MutableRefObject<boolean>;
}