import React, { useState } from 'react';
import { X, Eye, EyeOff, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { IntegrationSetupProps } from '../../_shared/types/IntegrationSetup';
import { VaultService } from '../../_shared/services/VaultService';

interface MistralOCRFormData {
  api_key: string;
  connection_name: string;
  model: string;
  max_pages: number;
  include_images: boolean;
}

export function MistralOCRSetupModal({
  integration,
  isOpen,
  onClose,
  onSuccess,
  onError,
  user,
  supabase
}: IntegrationSetupProps) {
  const [formData, setFormData] = useState<MistralOCRFormData>({
    api_key: '',
    connection_name: 'Mistral OCR Connection',
    model: 'mistral-ocr-latest',
    max_pages: 10,
    include_images: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const validateForm = (): boolean => {
    if (!formData.api_key.trim()) {
      setError('Mistral AI API key is required');
      return false;
    }
    if (!formData.connection_name.trim()) {
      setError('Connection name is required');
      return false;
    }
    if (formData.max_pages < 1 || formData.max_pages > 100) {
      setError('Max pages must be between 1 and 100');
      return false;
    }
    return true;
  };

  const testConnection = async () => {
    if (!validateForm()) return;

    setTestingConnection(true);
    setTestResult(null);
    setError(null);

    try {
      // Test the Mistral API key by making a simple request
      const response = await fetch('/api/integrations/mistral-ocr/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: formData.api_key,
          model: formData.model
        })
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult({
          success: true,
          message: 'Connection successful! API key is valid.'
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Failed to connect to Mistral AI API'
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: 'Network error: Unable to test connection'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleMistralOCRSetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);
    setTestResult(null);

    try {
      // Get Mistral AI service provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'mistral_ai')
        .single();

      if (providerError) {
        throw new Error(`Mistral AI provider not found: ${providerError.message}`);
      }

      // Store API key securely in vault following the encryption protocol
      const secretName = VaultService.generateSecretName('mistral_ai', 'api_key', user.id);
      const description = VaultService.generateSecretDescription('mistral_ai', 'API key', user.id);
      
      const { data: vaultId, error: vaultError } = await supabase.rpc('create_vault_secret', {
        p_secret: formData.api_key,
        p_name: secretName,
        p_description: description
      });

      if (vaultError || !vaultId) {
        throw new Error(`Failed to secure API key in vault: ${vaultError?.message}`);
      }

      console.log(`✅ Mistral AI API key securely stored in vault: ${vaultId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: `Mistral AI User`,
          connection_name: formData.connection_name,
          encrypted_access_token: null, // ✅ Never store plain text
          vault_access_token_id: vaultId, // ✅ Store vault UUID only
          vault_refresh_token_id: null, // Not applicable for API keys
          encrypted_refresh_token: null, // ✅ Never store plain text
          scopes_granted: ['ocr', 'document_processing'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store Mistral-specific configuration
          connection_metadata: {
            model: formData.model,
            max_pages: formData.max_pages,
            include_images: formData.include_images,
            api_version: 'v1',
            features: {
              structured_output: true,
              image_extraction: formData.include_images,
              bbox_annotation: true,
              document_annotation: true,
              markdown_output: true,
              multi_page_support: true
            }
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to save connection: ${insertError.message}`);
      }

      console.log('✅ Mistral OCR integration configured successfully');

      // Clear form
      setFormData({
        api_key: '',
        connection_name: 'Mistral OCR Connection',
        model: 'mistral-ocr-latest',
        max_pages: 10,
        include_images: false
      });

      // Call onSuccess with the expected connection data format
      onSuccess?.({
        connection_id: connectionData.id,
        connection_name: connectionData.connection_name,
        provider_name: 'mistral_ai',
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });
      onClose();

    } catch (error: any) {
      console.error('❌ Mistral OCR setup failed:', error);
      const errorMessage = error.message || 'Failed to configure Mistral OCR integration';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
          {/* API Key Setup Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 dark:text-blue-100">Get your Mistral AI API Key</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  You'll need a Mistral AI API key to use OCR services.
                </p>
                <a
                  href="https://console.mistral.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mt-2"
                >
                  <span>Get API Key from Mistral Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}

          {testResult && (
            <div className={`border rounded-lg p-4 ${
              testResult.success 
                ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-start space-x-3">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm ${
                    testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                  }`}>
                    {testResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Connection Name */}
            <div>
              <label htmlFor="connection_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Connection Name
              </label>
              <input
                id="connection_name"
                type="text"
                value={formData.connection_name}
                onChange={(e) => setFormData({ ...formData, connection_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="My Mistral OCR Connection"
                disabled={loading}
              />
            </div>

            {/* API Key */}
            <div>
              <label htmlFor="api_key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mistral AI API Key *
              </label>
              <div className="relative">
                <input
                  id="api_key"
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter your Mistral AI API key"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={loading}
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                OCR Model
              </label>
              <select
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="mistral-ocr-latest">mistral-ocr-latest</option>
                <option value="mistral-ocr-v1">mistral-ocr-v1</option>
              </select>
            </div>

            {/* Max Pages */}
            <div>
              <label htmlFor="max_pages" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Pages per Request
              </label>
              <input
                id="max_pages"
                type="number"
                min="1"
                max="100"
                value={formData.max_pages}
                onChange={(e) => setFormData({ ...formData, max_pages: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Maximum number of pages to process in a single request (1-100)
              </p>
            </div>

            {/* Include Images */}
            <div className="flex items-center space-x-3">
              <input
                id="include_images"
                type="checkbox"
                checked={formData.include_images}
                onChange={(e) => setFormData({ ...formData, include_images: e.target.checked })}
                className="w-4 h-4 text-orange-600 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500 bg-white dark:bg-gray-800"
                disabled={loading}
              />
              <label htmlFor="include_images" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Extract and include images from documents
              </label>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={testConnection}
              disabled={loading || testingConnection || !formData.api_key.trim()}
              className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={handleMistralOCRSetup}
              disabled={loading || testingConnection}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-md hover:from-orange-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Connecting...' : 'Connect Mistral OCR'}
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>• Your API key will be securely encrypted and stored</p>
            <p>• Mistral OCR supports PDF, images, and Office documents</p>
            <p>• Usage will be billed according to your Mistral AI plan</p>
          </div>
    </div>
  );
}
