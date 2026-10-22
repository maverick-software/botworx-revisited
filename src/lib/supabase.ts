import { createClient } from '@supabase/supabase-js';
import { backOff } from 'exponential-backoff';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is not defined in environment variables');
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is not defined in environment variables');
}

// Global singleton pattern that survives HMR in development
declare global {
  var __supabase_client__: any;
}

// Create a single instance of the Supabase client with optimized settings
let supabaseInstance = globalThis.__supabase_client__;

if (!supabaseInstance) {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Creating new Supabase client instance');
  }
  
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'agentopia',
    },
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 15, // Increased for better responsiveness
      heartbeatIntervalMs: 20000, // More frequent heartbeat (20 seconds)
      reconnectDelay: 1000, // Faster reconnect (1 second)
      timeout: 15000, // Longer timeout for stability (15 seconds)
      logger: (level, message, data) => {
        // Only log errors to reduce noise
        if (level === 'error') {
          console.error('Supabase Realtime:', message, data);
        }
      }
    }
  },
      // Increase timeout and add proper error handling
  opts: {
    timeout: 60000, // 60 seconds for regular API calls
    retries: 3
  }
  });
  
  // Store globally to survive HMR
  globalThis.__supabase_client__ = supabaseInstance;
} else {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔄 Reusing existing Supabase client instance');
  }
}

export const supabase = supabaseInstance;

// Admin client - for backend service-to-service communication
let supabaseAdminClient: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient => {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const adminUrl = process.env.SUPABASE_URL; // Assuming same URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase URL or Service Role Key is not defined for admin client.'
    );
  }

  supabaseAdminClient = createClient(adminUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: 'agentopia-admin-token' // Separate storage key for admin client
    },
    // Add any other admin-specific options if needed
  });

  console.log('Supabase admin client initialized.');
  return supabaseAdminClient;
};

// Export types for better type safety
export type Database = {
  public: {
    Tables: {
      datastores: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          type: 'pinecone' | 'getzep';
          config: {
            apiKey?: string;
            region?: string;
            host?: string;
            indexName?: string;
            dimensions?: number;
            projectId?: string;
            collectionName?: string;
          };
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['datastores']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['datastores']['Insert']>;
      };
    };
  };
};

// Improved utility function to check Supabase connection with better error handling
export const isSupabaseConnected = async () => {
  try {
    // First verify the environment variables are properly loaded
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase configuration missing:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey
      });
      return false;
    }

    console.log('Attempting to connect to Supabase at:', supabaseUrl);

    // Test the connection with a simple query and retry logic
    await backOff(
      async () => {
        // Use the agents table which we know exists in our schema
        const { error } = await supabase
          .from('agents')
          .select('id')
          .limit(1);

        if (error) {
          console.error('Supabase connection test error:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          });
          throw error;
        }

        return true;
      },
      {
        numOfAttempts: 3,
        startingDelay: 2500,
        maxDelay: 10000,
        timeMultiple: 2,
        retry: (e, attemptNumber) => {
          console.warn(`Supabase connection test attempt ${attemptNumber} failed:`, {
            error: e,
            message: e.message,
            name: e.name
          });
          return true; // Always retry until max attempts reached
        }
      }
    );
    
    console.log('Successfully connected to Supabase');
    return true;
  } catch (error) {
    console.error('Failed to connect to Supabase after all retries:', {
      error,
      message: error.message,
      name: error.name,
      stack: error.stack,
      url: supabaseUrl
    });
    return false;
  }
};

// Utility function for robust subscription setup with better error handling
export const createRobustSubscription = (
  channelName: string,
  config: {
    table: string;
    event: string;
    schema?: string;
    filter?: string;
  },
  onData: (payload: any) => void,
  onStatus?: (status: string, error?: any) => void
) => {
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: config.event as any,
        schema: config.schema || 'public',
        table: config.table,
        ...(config.filter && { filter: config.filter }),
      },
      onData
    )
    .subscribe((status, err) => {
      const errorMessage = err || (status === 'CHANNEL_ERROR' ? 'Connection lost' : undefined);
      
      // Only log in development to reduce console noise
      if (process.env.NODE_ENV === 'development') {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Connected to ${channelName}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.warn(`🔄 ${channelName} connection interrupted, auto-reconnecting...`);
        } else if (status === 'CLOSED') {
          console.info(`📪 ${channelName} subscription closed`);
        } else if (status === 'TIMED_OUT') {
          console.warn(`⏱️ ${channelName} subscription timed out`);
        }
      }
      
      onStatus?.(status, errorMessage);
    });
    
  return channel;
};

// Initialize connection check
isSupabaseConnected().then(connected => {
  if (connected) {
    console.log('Initial Supabase connection test successful');
  } else {
    console.error('Initial Supabase connection test failed');
  }
});