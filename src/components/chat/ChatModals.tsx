import React from 'react';
import { AgentSettingsModal } from '../modals/AgentSettingsModal';
import { ProcessModal } from '../modals/ProcessModal';
import type { Database } from '../../types/database.types';

type Agent = Database['public']['Tables']['agents']['Row'];

interface ChatModalsProps {
  // Modal states
  showAgentSettingsModal: boolean;
  showProcessModal?: boolean;
  
  // Modal close handlers
  setShowAgentSettingsModal: (show: boolean) => void;
  setShowProcessModal?: (show: boolean) => void;
  
  // Data
  agentId: string;
  agent: Agent | null;
  agentSettingsInitialTab?: 'general' | 'schedule' | 'identity' | 'behavior' | 'reasoning' | 'memory' | 'media' | 'tools' | 'channels' | 'sources' | 'team' | 'contacts' | 'workflows' | 'automations' | 'zapier-mcp';
  currentProcessingDetails?: any;
  
  // Handlers
  onAgentUpdated: (updatedAgent: Agent) => void;
  updateAgent: (id: string, data: any) => Promise<void>;
}

export function ChatModals({
  // Modal states
  showAgentSettingsModal,
  showProcessModal = false,
  
  // Modal close handlers
  setShowAgentSettingsModal,
  setShowProcessModal,
  
  // Data
  agentId,
  agent,
  agentSettingsInitialTab = 'general',
  currentProcessingDetails,
  
  // Handlers
  onAgentUpdated,
  updateAgent
}: ChatModalsProps) {
  return (
    <>
      {/* Agent Settings Modal - Unified settings interface */}
      <AgentSettingsModal
        isOpen={showAgentSettingsModal}
        onClose={() => setShowAgentSettingsModal(false)}
        agentId={agentId}
        agentData={{
          name: agent?.name,
          description: agent?.description,
          personality: agent?.personality,
          avatar_url: agent?.avatar_url,
          agent_datastores: agent?.agent_datastores,
          metadata: agent?.metadata,
          user_id: agent?.user_id
        }}
        initialTab={agentSettingsInitialTab}
        onAgentUpdated={async (updatedAgent) => {
          onAgentUpdated(updatedAgent);
          // Also update the agents hook state so sidebar gets updated
          if (agentId) {
            await updateAgent(agentId, updatedAgent);
          }
        }}
      />
      
      {/* Process Modal - Shows detailed AI processing information */}
      {showProcessModal && setShowProcessModal && (
        <ProcessModal
          isOpen={showProcessModal}
          onClose={() => setShowProcessModal(false)}
          processingDetails={currentProcessingDetails}
        />
      )}
    </>
  );
}
