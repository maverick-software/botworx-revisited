import React, { useState, useEffect } from 'react';
import { FileText, Settings, Trash2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { MistralOCRSetupModal } from './MistralOCRSetupModal';

interface MistralOCRConnection {
  id: string;
  connection_name: string;
  connection_status: 'active' | 'error' | 'expired';
  connection_metadata: {
    model: string;
    max_pages: number;
    include_images: boolean;
    api_version: string;
    features: {
      structured_output: boolean;
      image_extraction: boolean;
      bbox_annotation: boolean;
      document_annotation: boolean;
      markdown_output: boolean;
      multi_page_support: boolean;
    };
  };
  created_at: string;
  updated_at: string;
}

interface MistralOCRIntegrationCardProps {
  className?: string;
}

export function MistralOCRIntegrationCard({ className }: MistralOCRIntegrationCardProps) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<MistralOCRConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [deletingConnection, setDeletingConnection] = useState<string | null>(null);

  const fetchConnections = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('mistral_ocr_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(`Failed to fetch connections: ${fetchError.message}`);
      }

      setConnections(data || []);
    } catch (err: any) {
      console.error('Error fetching Mistral OCR connections:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!user || !confirm('Are you sure you want to delete this Mistral OCR connection?')) {
      return;
    }

    try {
      setDeletingConnection(connectionId);

      const { error: deleteError } = await supabase
        .from('user_integration_credentials')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', user.id);

      if (deleteError) {
        throw new Error(`Failed to delete connection: ${deleteError.message}`);
      }

      // Refresh connections list
      await fetchConnections();
    } catch (err: any) {
      console.error('Error deleting connection:', err);
      setError(err.message);
    } finally {
      setDeletingConnection(null);
    }
  };

  const handleSetupSuccess = (message: string) => {
    console.log('Mistral OCR setup successful:', message);
    fetchConnections(); // Refresh the connections list
  };

  const handleSetupError = (message: string) => {
    console.error('Mistral OCR setup error:', message);
    setError(message);
  };

  useEffect(() => {
    fetchConnections();
  }, [user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Connected';
      case 'error':
        return 'Error';
      case 'expired':
        return 'Expired';
      default:
        return 'Unknown';
    }
  };

  return (
    <>
      <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Mistral OCR</h3>
                <p className="text-sm text-gray-600">Advanced AI-powered document processing</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <a
                href="https://docs.mistral.ai/api/#tag/ocr"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="View Documentation"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
              <span className="ml-2 text-sm text-gray-600">Loading connections...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          ) : connections.length > 0 ? (
            <div className="space-y-4">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getStatusIcon(connection.connection_status)}
                        <span className="font-medium text-gray-900">
                          {connection.connection_name}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          connection.connection_status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : connection.connection_status === 'error'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {getStatusText(connection.connection_status)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium">Model:</span> {connection.connection_metadata.model}
                        </p>
                        <p>
                          <span className="font-medium">Max Pages:</span> {connection.connection_metadata.max_pages}
                        </p>
                        <p>
                          <span className="font-medium">Image Extraction:</span>{' '}
                          {connection.connection_metadata.include_images ? 'Enabled' : 'Disabled'}
                        </p>
                        <p>
                          <span className="font-medium">Features:</span>{' '}
                          {Object.entries(connection.connection_metadata.features)
                            .filter(([_, enabled]) => enabled)
                            .map(([feature, _]) => feature.replace(/_/g, ' '))
                            .join(', ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(connection.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleDeleteConnection(connection.id)}
                        disabled={deletingConnection === connection.id}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Delete Connection"
                      >
                        {deletingConnection === connection.id ? (
                          <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Mistral OCR Connections</h4>
              <p className="text-gray-600 mb-4">
                Connect your Mistral AI account to enable advanced OCR and document processing capabilities.
              </p>
            </div>
          )}

          {/* Features List */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Mistral OCR Features</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>High-accuracy OCR</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Multi-page processing</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Image extraction</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Structured output</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Markdown formatting</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Bounding box annotations</span>
              </div>
            </div>
          </div>

          {/* Connect Button */}
          <div className="mt-6">
            <button
              onClick={() => setShowSetupModal(true)}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-md hover:from-orange-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
            >
              {connections.length > 0 ? 'Add Another Connection' : 'Connect Mistral OCR'}
            </button>
          </div>
        </div>
      </div>

      {/* Setup Modal */}
      <MistralOCRSetupModal
        integration={{
          id: 'mistral-ocr',
          name: 'Mistral OCR',
          description: 'Advanced AI-powered document processing',
          category_id: '',
          icon_name: 'FileText',
          status: 'available',
          is_popular: true,
          documentation_url: 'https://docs.mistral.ai/api/#tag/ocr',
          configuration_schema: {},
          required_oauth_provider_id: null,
          required_tool_catalog_id: null,
          display_order: 0,
          is_active: true,
          created_at: '',
          updated_at: '',
          agent_classification: 'tool'
        }}
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSuccess={handleSetupSuccess}
        onError={handleSetupError}
        user={user}
        supabase={supabase}
      />
    </>
  );
}
