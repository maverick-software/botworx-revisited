// Common interface for tabs that support saving
export interface TabRef {
  save: () => Promise<void>;
  hasChanges: boolean;
  saving: boolean;
  saveSuccess: boolean;
}

// Common props interface for all tabs
export interface TabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

