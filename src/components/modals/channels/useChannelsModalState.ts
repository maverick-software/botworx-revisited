import { useState, useEffect } from 'react';

interface AgentPermission {
  id: string;
  connection_id: string;
  provider_name: string;
  external_username?: string | null;
  is_active: boolean;
  allowed_scopes?: string[];
}

interface ChannelFormState {
  // UI state
  activeTab: string;
  connectingService: string | null;
  setupService: string | null;
  selectingCredentialFor: string | null;
  saved: boolean;
  error: string | null;
  
  // Permission management state
  editingPermission: AgentPermission | null;
  showPermissionsModal: boolean;
  selectedScopes: string[];
  
  // Form fields
  connectionName: string;
  apiKey: string;
  fromEmail: string;
  fromName: string;
  mailgunDomain: string;
  
  // SMTP form fields
  smtpHost: string;
  smtpPort: string;
  smtpSecure: string;
  smtpUsername: string;
  smtpPassword: string;
}

const initialState: ChannelFormState = {
  activeTab: 'connected',
  connectingService: null,
  setupService: null,
  selectingCredentialFor: null,
  saved: false,
  error: null,
  editingPermission: null,
  showPermissionsModal: false,
  selectedScopes: [],
  connectionName: '',
  apiKey: '',
  fromEmail: '',
  fromName: '',
  mailgunDomain: '',
  smtpHost: '',
  smtpPort: '587',
  smtpSecure: 'tls',
  smtpUsername: '',
  smtpPassword: ''
};

export function useChannelsModalState() {
  const [state, setState] = useState<ChannelFormState>(initialState);

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
  const updateState = (updates: Partial<ChannelFormState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const setActiveTab = (tab: string) => updateState({ activeTab: tab });
  const setConnectingService = (service: string | null) => updateState({ connectingService: service });
  const setSetupService = (service: string | null) => updateState({ setupService: service });
  const setSelectingCredentialFor = (service: string | null) => updateState({ selectingCredentialFor: service });
  const setSaved = (saved: boolean) => updateState({ saved });
  const setError = (error: string | null) => updateState({ error });
  
  // Permission management
  const setEditingPermission = (permission: AgentPermission | null) => updateState({ editingPermission: permission });
  const setShowPermissionsModal = (show: boolean) => updateState({ showPermissionsModal: show });
  const setSelectedScopes = (scopes: string[]) => updateState({ selectedScopes: scopes });
  
  // Form fields
  const setConnectionName = (name: string) => updateState({ connectionName: name });
  const setApiKey = (key: string) => updateState({ apiKey: key });
  const setFromEmail = (email: string) => updateState({ fromEmail: email });
  const setFromName = (name: string) => updateState({ fromName: name });
  const setMailgunDomain = (domain: string) => updateState({ mailgunDomain: domain });
  
  // SMTP form fields
  const setSMTPHost = (host: string) => updateState({ smtpHost: host });
  const setSMTPPort = (port: string) => updateState({ smtpPort: port });
  const setSMTPSecure = (secure: string) => updateState({ smtpSecure: secure });
  const setSMTPUsername = (username: string) => updateState({ smtpUsername: username });
  const setSMTPPassword = (password: string) => updateState({ smtpPassword: password });

  // Reset form helper
  const resetForm = () => {
    updateState({
      connectionName: '',
      apiKey: '',
      fromEmail: '',
      fromName: '',
      mailgunDomain: '',
      smtpHost: '',
      smtpPort: '587',
      smtpSecure: 'tls',
      smtpUsername: '',
      smtpPassword: '',
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
    setError,
    setEditingPermission,
    setShowPermissionsModal,
    setSelectedScopes,
    setConnectionName,
    setApiKey,
    setFromEmail,
    setFromName,
    setMailgunDomain,
    setSMTPHost,
    setSMTPPort,
    setSMTPSecure,
    setSMTPUsername,
    setSMTPPassword,
    
    // Helpers
    updateState,
    resetForm
  };
}
