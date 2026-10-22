import { useState, useEffect } from 'react';

interface ToolsModalState {
  // UI state
  activeTab: string;
  connectingService: string | null;
  setupService: string | null;
  selectingCredentialFor: string | null;
  saved: boolean;
  showZapierModal: boolean;
  zapierToolsCount: number;
  zapierToolsRefreshKey: number;
  error: string | null;
  
  // Form fields
  selectedProvider: string;
  apiKey: string;
  connectionName: string;
}

const initialState: ToolsModalState = {
  activeTab: 'connected',
  connectingService: null,
  setupService: null,
  selectingCredentialFor: null,
  saved: false,
  showZapierModal: false,
  zapierToolsCount: 0,
  zapierToolsRefreshKey: 0,
  error: null,
  selectedProvider: '',
  apiKey: '',
  connectionName: ''
};

export function useToolsModalState() {
  const [state, setState] = useState<ToolsModalState>(initialState);

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (state.saved) {
      const timer = setTimeout(() => 
        setState(prev => ({ ...prev, saved: false })), 
        3000
      );
      return () => clearTimeout(timer);
    }
  }, [state.saved]);

  // State update helpers
  const updateState = (updates: Partial<ToolsModalState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const setActiveTab = (tab: string) => updateState({ activeTab: tab });
  const setConnectingService = (service: string | null) => updateState({ connectingService: service });
  const setSetupService = (service: string | null) => updateState({ setupService: service });
  const setSelectingCredentialFor = (service: string | null) => updateState({ selectingCredentialFor: service });
  const setSaved = (saved: boolean) => updateState({ saved });
  const setShowZapierModal = (show: boolean) => updateState({ showZapierModal: show });
  const setZapierToolsCount = (count: number) => updateState({ zapierToolsCount: count });
  const setZapierToolsRefreshKey = (key: number) => updateState({ zapierToolsRefreshKey: key });
  const setError = (error: string | null) => updateState({ error });
  
  // Form fields
  const setSelectedProvider = (provider: string) => updateState({ selectedProvider: provider });
  const setApiKey = (key: string) => updateState({ apiKey: key });
  const setConnectionName = (name: string) => updateState({ connectionName: name });

  // Reset form helper
  const resetForm = () => {
    updateState({
      selectedProvider: '',
      apiKey: '',
      connectionName: '',
      error: null
    });
  };

  return {
    // State
    ...state,
    
    // State setters
    setActiveTab,
    setConnectingService,
    setSetupService,
    setSelectingCredentialFor,
    setSaved,
    setShowZapierModal,
    setZapierToolsCount,
    setZapierToolsRefreshKey,
    setError,
    setSelectedProvider,
    setApiKey,
    setConnectionName,
    
    // Helpers
    updateState,
    resetForm
  };
}

