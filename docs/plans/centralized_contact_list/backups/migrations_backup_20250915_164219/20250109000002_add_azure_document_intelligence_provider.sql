-- =====================================================
-- ADD AZURE DOCUMENT INTELLIGENCE SERVICE PROVIDER
-- =====================================================
-- Add Azure Document Intelligence as a service provider for document processing

INSERT INTO public.service_providers (
  name,
  display_name,
  authorization_endpoint,
  token_endpoint,
  revoke_endpoint,
  discovery_endpoint,
  scopes_supported,
  pkce_required,
  client_credentials_location,
  is_enabled,
  configuration_metadata
) VALUES (
  'azure-document-intelligence',
  'Azure Document Intelligence',
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', -- Not used for API key auth
  'https://login.microsoftonline.com/common/oauth2/v2.0/token',       -- Not used for API key auth
  null,
  null,
  '["https://cognitiveservices.azure.com/.default"]'::jsonb,
  false, -- API key based, not OAuth
  'header',
  true,
  '{
    "auth_type": "api_key",
    "api_key_header": "Ocp-Apim-Subscription-Key",
    "base_url_template": "https://{region}.api.cognitive.microsoft.com/formrecognizer/documentModels/prebuilt-read:analyze",
    "supported_regions": [
      "eastus", "eastus2", "westus", "westus2", "centralus", "northcentralus", "southcentralus", "westcentralus",
      "canadacentral", "canadaeast", "brazilsouth", "northeurope", "westeurope", "uksouth", "ukwest",
      "francecentral", "switzerlandnorth", "germanywestcentral", "norwayeast", "uaenorth", "southafricanorth",
      "australiaeast", "australiasoutheast", "eastasia", "southeastasia", "japaneast", "japanwest",
      "koreacentral", "centralindia", "southindia", "westindia"
    ],
    "api_version": "2023-07-31",
    "features": [
      "document_analysis",
      "layout_analysis", 
      "table_extraction",
      "form_recognition",
      "receipt_processing",
      "invoice_processing",
      "business_card_processing",
      "id_document_processing"
    ],
    "supported_formats": [
      "pdf", "jpeg", "png", "bmp", "tiff", "heif", "docx", "xlsx", "pptx", "html"
    ],
    "pricing_tier": "premium",
    "documentation_url": "https://docs.microsoft.com/en-us/azure/cognitive-services/form-recognizer/",
    "setup_instructions": {
      "step1": "Create an Azure Cognitive Services resource in the Azure portal",
      "step2": "Navigate to your Form Recognizer resource",
      "step3": "Copy the API key from Keys and Endpoint section", 
      "step4": "Copy the endpoint URL (e.g., https://your-resource.cognitiveservices.azure.com/)",
      "step5": "Enter both the API key and endpoint in the setup form"
    }
  }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  configuration_metadata = EXCLUDED.configuration_metadata,
  updated_at = now();

-- Azure Document Intelligence service provider setup complete
-- Users can now configure this service through the integrations UI
-- Permissions will be managed through the agent_integration_permissions table
