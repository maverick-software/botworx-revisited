// Forcing linter re-evaluation after tsconfig.node.json change.
import DotsWrapper from 'https://esm.sh/dots-wrapper@3.11.17'; // Try default import
const { createApiClient } = DotsWrapper; // Then destructure
// Removed: import { IAPIClient } from 'dots-wrapper/dist/client';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Define the type for the DigitalOcean API client based on the return type of createApiClient
export type DotsApiClient = ReturnType<typeof createApiClient>;

// Initialize Supabase Admin Client
// Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in the environment for this service
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

let supabaseAdmin: SupabaseClient | null = null;
if (supabaseUrl && supabaseServiceRoleKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }, // Backend service, no session needed
  });
  console.info('Supabase admin client initialized for DigitalOcean service.');
} else {
  console.error(
    'Supabase URL or Service Role Key not found in environment. Vault operations will fail for DigitalOcean service.'
  );
}

interface VaultResponse {
  key: string | null;
  // Add other potential fields from the vault response if necessary
}

async function getSecretFromVault(secretId: string): Promise<string | null> {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not initialized. Cannot fetch secret from vault.');
    return null;
  }
  if (!secretId) {
    console.warn('getSecretFromVault: No secret ID provided.');
    return null;
  }

  try {
    console.log(`getSecretFromVault: Attempting to retrieve secret for vault ID: ${secretId}`);
    const { data, error } = await supabaseAdmin
      .rpc('get_secret', { secret_id: secretId })
      .single();

    if (error) {
      console.error(`getSecretFromVault: Error retrieving secret from vault (ID: ${secretId}):`, error);
      return null;
    }

    const vaultResponse = data as VaultResponse; // Type assertion
    if (vaultResponse?.key) {
      console.log(`getSecretFromVault: Successfully retrieved secret for vault ID: ${secretId}`);
      return vaultResponse.key;
    } else {
      console.warn(
        `getSecretFromVault: Secret retrieved but key was null or empty for vault ID: ${secretId}`
      );
      return null;
    }
  } catch (error) {
    console.error(`getSecretFromVault: Exception during secret retrieval for vault ID: ${secretId}:`, error);
    return null;
  }
}

let apiClientInstance: DotsApiClient | null = null;

/**
 * Initializes and returns the DigitalOcean API client.
 * Fetches the API token from a secure vault or directly from environment.
 * @returns {Promise<DotsApiClient>} The initialized API client.
 * @throws {Error} If the API token cannot be retrieved or client initialization fails.
 */
export async function getDOClient(): Promise<DotsApiClient> {
  if (apiClientInstance) {
    return apiClientInstance;
  }

  let apiToken: string | null = null;

  // First, try to get token from vault if vault ID is configured
  const apiTokenSecretId = Deno.env.get('DO_API_TOKEN_VAULT_ID');
  if (apiTokenSecretId) {
    console.log('DO_API_TOKEN_VAULT_ID found, attempting to retrieve token from Supabase Vault...');
    apiToken = await getSecretFromVault(apiTokenSecretId);
  }

  // Fallback: If vault retrieval failed or vault ID not configured, try direct token
  if (!apiToken) {
    console.log('Vault token retrieval failed or not configured, trying direct DO_API_TOKEN...');
    apiToken = Deno.env.get('DO_API_TOKEN');
    if (apiToken) {
      console.log('Successfully retrieved DO_API_TOKEN from environment variables.');
    }
  }

  if (!apiToken) {
    console.error('Failed to retrieve DigitalOcean API token from both Vault and direct environment variable.');
    throw new Error('DigitalOcean API token not found. Please configure either DO_API_TOKEN_VAULT_ID (for vault usage) or DO_API_TOKEN (for direct usage).');
  }

  try {
    apiClientInstance = createApiClient({ token: apiToken });
    console.info('DigitalOcean API client initialized successfully.');
    return apiClientInstance;
  } catch (error) {
    console.error('Failed to initialize DigitalOcean API client:', error);
    // Ensure the error is typed or cast to access error.message if needed
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to initialize DigitalOcean API client: ${errorMessage}`);
  }
}

// Optional: A way to get the client synchronously if it's guaranteed to be initialized
// Use with caution, prefer getDOClient for async safety.
export function getDOClientSync(): DotsApiClient {
  if (!apiClientInstance) {
    throw new Error('DigitalOcean API client has not been initialized. Call getDOClient() first.');
  }
  return apiClientInstance;
} 