import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { IntegrationSetupProps } from '@/types/integrations';
import { VaultService } from '@/integrations/_shared';

interface FormData {
  api_key: string;
  endpoint: string;
  region: string;
  connection_name: string;
}

const AZURE_REGIONS = [
  { value: 'eastus', label: 'East US' },
  { value: 'eastus2', label: 'East US 2' },
  { value: 'westus', label: 'West US' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'centralus', label: 'Central US' },
  { value: 'northcentralus', label: 'North Central US' },
  { value: 'southcentralus', label: 'South Central US' },
  { value: 'westcentralus', label: 'West Central US' },
  { value: 'canadacentral', label: 'Canada Central' },
  { value: 'canadaeast', label: 'Canada East' },
  { value: 'brazilsouth', label: 'Brazil South' },
  { value: 'northeurope', label: 'North Europe' },
  { value: 'westeurope', label: 'West Europe' },
  { value: 'uksouth', label: 'UK South' },
  { value: 'ukwest', label: 'UK West' },
  { value: 'francecentral', label: 'France Central' },
  { value: 'switzerlandnorth', label: 'Switzerland North' },
  { value: 'germanywestcentral', label: 'Germany West Central' },
  { value: 'norwayeast', label: 'Norway East' },
  { value: 'uaenorth', label: 'UAE North' },
  { value: 'southafricanorth', label: 'South Africa North' },
  { value: 'australiaeast', label: 'Australia East' },
  { value: 'australiasoutheast', label: 'Australia Southeast' },
  { value: 'eastasia', label: 'East Asia' },
  { value: 'southeastasia', label: 'Southeast Asia' },
  { value: 'japaneast', label: 'Japan East' },
  { value: 'japanwest', label: 'Japan West' },
  { value: 'koreacentral', label: 'Korea Central' },
  { value: 'centralindia', label: 'Central India' },
  { value: 'southindia', label: 'South India' },
  { value: 'westindia', label: 'West India' }
];

export function AzureDocumentIntelligenceSetupModal({
  integration,
  isOpen,
  onClose,
  onSuccess,
  onError,
  user,
  supabase
}: IntegrationSetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'success' | 'error' | null>(null);

  const [formData, setFormData] = useState<FormData>({
    api_key: '',
    endpoint: '',
    region: 'eastus',
    connection_name: 'Azure Document Intelligence'
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setConnectionTestResult(null);
  };

  const validateForm = (): boolean => {
    if (!formData.api_key.trim()) {
      setError('API key is required');
      return false;
    }

    if (formData.api_key.length < 32) {
      setError('API key appears to be invalid (too short)');
      return false;
    }

    if (!formData.endpoint.trim()) {
      setError('Endpoint URL is required');
      return false;
    }

    const endpointPattern = /^https:\/\/[a-zA-Z0-9-]+\.cognitiveservices\.azure\.com\/?$/;
    if (!endpointPattern.test(formData.endpoint)) {
      setError('Invalid endpoint URL format. Should be: https://your-resource.cognitiveservices.azure.com/');
      return false;
    }

    if (!formData.region) {
      setError('Azure region is required');
      return false;
    }

    return true;
  };

  const testConnection = async () => {
    if (!validateForm()) return;

    setTestingConnection(true);
    setConnectionTestResult(null);
    setError(null);

    try {
      // Test the connection by making a simple API call
      const testEndpoint = formData.endpoint.replace(/\/$/, '') + '/formrecognizer/info?api-version=2023-07-31';
      
      const response = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': formData.api_key,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionTestResult('success');
      } else {
        const errorText = await response.text();
        throw new Error(`Connection test failed: ${response.status} - ${errorText}`);
      }
    } catch (error: any) {
      console.error('Azure Document Intelligence connection test failed:', error);
      setConnectionTestResult('error');
      setError(`Connection test failed: ${error.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleAzureSetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get Azure Document Intelligence service provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'azure-document-intelligence')
        .single();

      if (providerError) {
        throw new Error(`Azure Document Intelligence provider not found: ${providerError.message}`);
      }

      // Store API key securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `azure_document_intelligence_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.api_key,
        `Azure Document Intelligence API key for ${formData.connection_name} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ Azure Document Intelligence API key securely stored in vault: ${vaultKeyId}`);

      // Store endpoint in vault as well (some endpoints contain sensitive info)
      const endpointSecretName = `azure_document_intelligence_endpoint_${user.id}_${Date.now()}`;
      const vaultEndpointId = await vaultService.createSecret(
        endpointSecretName,
        formData.endpoint,
        `Azure Document Intelligence endpoint for ${formData.connection_name} - Created: ${new Date().toISOString()}`
      );

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: 'azure_document_intelligence',
          connection_name: formData.connection_name,
          encrypted_access_token: null, // API key is in vault
          vault_access_token_id: vaultKeyId,
          vault_refresh_token_id: vaultEndpointId, // Store endpoint in refresh token field
          scopes_granted: ['document_analysis', 'form_processing', 'table_extraction', 'layout_analysis'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store Azure-specific configuration
          connection_metadata: {
            provider: 'azure-document-intelligence',
            region: formData.region,
            api_version: '2023-07-31',
            features: [
              'document_analysis',
              'layout_analysis', 
              'table_extraction',
              'form_recognition',
              'receipt_processing',
              'invoice_processing'
            ],
            supported_formats: ['pdf', 'jpeg', 'png', 'bmp', 'tiff', 'heif', 'docx', 'xlsx', 'pptx', 'html']
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to save connection: ${insertError.message}`);
      }

      console.log('✅ Azure Document Intelligence connection created:', connectionData);

      // Call success callback
      onSuccess?.({
        message: `Azure Document Intelligence connected successfully! Your documents will now benefit from enterprise-grade text extraction and analysis.`,
        connection: connectionData
      });

      // Reset form
      setFormData({
        api_key: '',
        endpoint: '',
        region: 'eastus',
        connection_name: 'Azure Document Intelligence'
      });

      onClose();

    } catch (error: any) {
      console.error('Azure Document Intelligence setup failed:', error);
      const errorMessage = error.message || 'Failed to set up Azure Document Intelligence';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto border-0 bg-white dark:bg-gray-900" style={{ zIndex: 9999 }}>
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <FileText className="h-5 w-5 text-blue-600" />
            Set up Azure Document Intelligence
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pr-2">
          {/* Connection Name */}
          <div className="space-y-2">
            <Label htmlFor="connection_name" className="text-gray-700 dark:text-gray-300">
              Connection Name
            </Label>
            <Input
              id="connection_name"
              type="text"
              value={formData.connection_name}
              onChange={(e) => handleInputChange('connection_name', e.target.value)}
              placeholder="Azure Document Intelligence"
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api_key" className="text-gray-700 dark:text-gray-300">
              API Key *
            </Label>
            <Input
              id="api_key"
              type="password"
              value={formData.api_key}
              onChange={(e) => handleInputChange('api_key', e.target.value)}
              placeholder="Enter your Azure Form Recognizer API key"
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Found in your Azure portal under Keys and Endpoint
            </p>
          </div>

          {/* Endpoint URL */}
          <div className="space-y-2">
            <Label htmlFor="endpoint" className="text-gray-700 dark:text-gray-300">
              Endpoint URL *
            </Label>
            <Input
              id="endpoint"
              type="url"
              value={formData.endpoint}
              onChange={(e) => handleInputChange('endpoint', e.target.value)}
              placeholder="https://your-resource.cognitiveservices.azure.com/"
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Your Form Recognizer endpoint from the Azure portal
            </p>
          </div>

          {/* Region */}
          <div className="space-y-2">
            <Label htmlFor="region" className="text-gray-700 dark:text-gray-300">
              Azure Region *
            </Label>
            <Select value={formData.region} onValueChange={(value) => handleInputChange('region', value)}>
              <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                <SelectValue placeholder="Select your Azure region" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                {AZURE_REGIONS.map((region) => (
                  <SelectItem key={region.value} value={region.value}>
                    {region.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Connection Test */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={testingConnection || !formData.api_key || !formData.endpoint}
              className="flex items-center gap-2"
            >
              {testingConnection ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : connectionTestResult === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : connectionTestResult === 'error' ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : null}
              Test Connection
            </Button>
            {connectionTestResult === 'success' && (
              <span className="text-sm text-green-600 dark:text-green-400">Connection successful!</span>
            )}
          </div>

          {/* Setup Instructions */}
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <FileText className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <div className="space-y-2">
                <p className="font-medium">Setup Instructions:</p>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Create a Form Recognizer resource in Azure portal</li>
                  <li>Navigate to Keys and Endpoint section</li>
                  <li>Copy your API key and endpoint URL</li>
                  <li>Select the matching Azure region</li>
                </ol>
                <a 
                  href="https://docs.microsoft.com/en-us/azure/cognitive-services/form-recognizer/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View Azure Documentation <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </AlertDescription>
          </Alert>

          {/* Error Display */}
          {error && (
            <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-gray-300 dark:border-gray-600"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAzureSetup}
              disabled={loading || !formData.api_key || !formData.endpoint}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Azure Document Intelligence'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}