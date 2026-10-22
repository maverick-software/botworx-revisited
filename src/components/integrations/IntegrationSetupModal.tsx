import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { 
  getIntegrationSetupComponent, 
  integrationSetupRegistry,
  type IntegrationSetupProps 
} from '@/integrations/_shared';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface IntegrationSetupModalProps {
  integration: any;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * Modular Integration Setup Modal
 * Uses the integration registry to load the appropriate setup component for each integration
 */
export function IntegrationSetupModal({ 
  integration, 
  isOpen, 
  onClose, 
  onComplete 
}: IntegrationSetupModalProps) {
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  // Component lifecycle debugging (commented out for production)
  // React.useEffect(() => {
  //   console.log('[IntegrationSetupModal] Component mounted');
  //   return () => console.log('[IntegrationSetupModal] Component will unmount');
  // }, []);
  
  // React.useEffect(() => {
  //   console.log('[IntegrationSetupModal] isOpen changed:', { isOpen, integrationName: integration?.name });
  // }, [isOpen]);

  // Handle setup success
  const handleSetupSuccess = (connection: {
    connection_id: string;
    connection_name: string;
    provider_name: string;
    external_username?: string;
    scopes_granted: string[];
  }) => {
    console.log('Integration setup successful:', connection);
    toast.success(`${integration.name} connected successfully! 🎉`);
    onComplete();
  };

  // Handle setup error
  const handleSetupError = (errorMessage: string) => {
    console.error('Integration setup error:', errorMessage);
    setError(errorMessage);
    toast.error(`Failed to setup ${integration.name}`);
  };

  // Handle modal close
  const handleClose = () => {
    setError(null);
    onClose();
  };

  // Don't return null - this would unmount the component
  // Instead, just don't show the dialog when there's no integration
  const shouldShowDialog = isOpen && !!integration;

  // Check if we have a registered setup component for this integration
  const hasRegisteredSetup = integration && integration.name in integrationSetupRegistry;

  // Use modal prop to prevent content unmounting when closed
  // This preserves form state when tabbing away
  return (
    <Dialog 
      open={shouldShowDialog} 
      onOpenChange={(open) => {
        console.log('[IntegrationSetupModal] Dialog onOpenChange:', { 
          open, 
          shouldShowDialog,
          hasIntegration: !!integration,
          timestamp: new Date().toISOString() 
        });
      if (!open) handleClose();
      }}
      modal={true}
    >
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <div className="p-2 bg-muted rounded-lg">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
            </div>
            Setup {integration?.name || 'Integration'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {integration?.description || (integration ? `Connect your ${integration.name} account to expand your agent's capabilities.` : 'Select an integration to continue.')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-1">
          {integration ? (
            hasRegisteredSetup ? (
              // Use registered setup component
              <RegisteredIntegrationSetup
                integration={integration}
                user={user}
                supabase={supabase}
                onSuccess={handleSetupSuccess}
                onError={handleSetupError}
                onClose={handleClose}
              />
            ) : (
              // Fallback for integrations without registered setup components
              <FallbackIntegrationSetup
                integration={integration}
                onClose={handleClose}
              />
            )
          ) : (
            // No integration selected
            <div className="p-6 text-center text-muted-foreground">
              Select an integration to begin setup.
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-4">
                            <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        )}
                      </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Component that renders the registered setup component for an integration
 */
function RegisteredIntegrationSetup({
  integration,
  user,
  supabase,
  onSuccess,
  onError,
  onClose
}: {
  integration: any;
  user: any;
  supabase: any;
  onSuccess: IntegrationSetupProps['onSuccess'];
  onError: IntegrationSetupProps['onError'];
  onClose: () => void;
}) {
  try {
    const SetupComponent = getIntegrationSetupComponent(integration.name);
    
    return (
      <SetupComponent
        integration={integration}
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        onError={onError}
        user={user}
        supabase={supabase}
      />
    );
  } catch (err: any) {
    console.error('Failed to load setup component:', err);
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load setup component for {integration.name}: {err.message}
                          </AlertDescription>
                        </Alert>
    );
  }
}

/**
 * Fallback component for integrations without registered setup components
 */
function FallbackIntegrationSetup({
  integration,
  onClose
}: {
  integration: any;
  onClose: () => void;
}) {
  return (
    <div className="space-y-6 p-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p><strong>{integration.name} integration is not yet fully configured.</strong></p>
            <p>This integration is available but requires additional setup that hasn't been implemented yet.</p>
            <p>Please check back later or contact support if you need this integration urgently.</p>
                          </div>
                          </AlertDescription>
                        </Alert>

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors"
        >
          Close
        </button>
                  </div>
              </div>
  );
} 
