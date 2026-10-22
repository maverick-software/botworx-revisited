// src/lib/config/environment.ts
// Environment configuration management for MCP Server Integration

/**
 * Environment types supported by the application
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Application configuration interface
 */
export interface AppConfig {
  // Core settings
  environment: Environment;
  isDevelopment: boolean;
  isProduction: boolean;
  isStaging: boolean;
  
  // Base URLs
  baseUrl: string;
  apiBaseUrl: string;
  
  // Supabase configuration
  supabase: {
    url: string;
    anonKey: string;
  };
  
  // DTMA API configuration
  dtma: {
    apiUrl: string;
    apiVersion: string;
  };
  
  // MCP-specific configuration
  mcp: {
    apiBaseUrl: string;
    marketplaceApiUrl: string;
    registryUrl: string;
    healthCheckInterval: number;
    healthCheckTimeout: number;
    maxRestartAttempts: number;
  };
  
  // Feature flags
  features: {
    mcpMarketplace: boolean;
    mcpDeployment: boolean;
    mcpMonitoring: boolean;
    mcpTemplates: boolean;
    serverCloning: boolean;
    bulkOperations: boolean;
    customDomains: boolean;
  };
  
  // Development settings
  dev: {
    debugMode: boolean;
    mockApiEnabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  
  // Monitoring configuration
  monitoring: {
    sentryDsn?: string;
    performanceEnabled: boolean;
    analyticsEnabled: boolean;
  };
}

/**
 * Get environment variable with optional default value
 */
function getEnvVar(key: string, defaultValue?: string, silent = false): string {
  const value = import.meta.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    if (!silent) {
      console.warn(`Environment variable ${key} is not defined`);
    }
    return '';
  }
  return value;
}

/**
 * Get boolean environment variable
 */
function getEnvBool(key: string, defaultValue = false): boolean {
  const value = getEnvVar(key, undefined, true); // Silent for boolean with defaults
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get numeric environment variable
 */
function getEnvNumber(key: string, defaultValue = 0): number {
  const value = getEnvVar(key, undefined, true); // Silent for numbers with defaults
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Determine current environment
 */
function getCurrentEnvironment(): Environment {
  const nodeEnv = getEnvVar('NODE_ENV', 'development');
  const viteEnv = getEnvVar('VITE_APP_ENV', nodeEnv);
  
  switch (viteEnv.toLowerCase()) {
    case 'production':
    case 'prod':
      return 'production';
    case 'staging':
    case 'stage':
      return 'staging';
    case 'test':
    case 'testing':
      return 'test';
    default:
      return 'development';
  }
}

/**
 * Build application configuration from environment variables
 */
function buildConfig(): AppConfig {
  const environment = getCurrentEnvironment();
  
  return {
    // Core settings
    environment,
    isDevelopment: environment === 'development',
    isProduction: environment === 'production',
    isStaging: environment === 'staging',
    
    // Base URLs
    baseUrl: getEnvVar('VITE_APP_BASE_URL', 'http://localhost:5173'),
    apiBaseUrl: getEnvVar('VITE_API_BASE_URL', 'http://localhost:3000'),
    
    // Supabase configuration
    supabase: {
      url: getEnvVar('VITE_SUPABASE_URL'),
      anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY'),
    },
    
    // DTMA API configuration
    dtma: {
      apiUrl: getEnvVar('VITE_DTMA_API_URL', 'http://localhost:8000'),
      apiVersion: getEnvVar('VITE_DTMA_API_VERSION', 'v1'),
    },
    
    // MCP-specific configuration
    mcp: {
      apiBaseUrl: getEnvVar('VITE_MCP_API_BASE_URL', 'http://localhost:8000/api/mcp'),
      marketplaceApiUrl: getEnvVar('VITE_MCP_MARKETPLACE_API_URL', 'https://marketplace.mcp-servers.com/api'),
      registryUrl: getEnvVar('VITE_MCP_REGISTRY_URL', 'https://registry.mcp-servers.com'),
      healthCheckInterval: getEnvNumber('VITE_MCP_HEALTH_CHECK_INTERVAL', 30000),
      healthCheckTimeout: getEnvNumber('VITE_MCP_HEALTH_CHECK_TIMEOUT', 5000),
      maxRestartAttempts: getEnvNumber('VITE_MCP_MAX_RESTART_ATTEMPTS', 3),
    },
    
    // Feature flags
    features: {
      mcpMarketplace: getEnvBool('VITE_FEATURE_MCP_MARKETPLACE', true),
      mcpDeployment: getEnvBool('VITE_FEATURE_MCP_DEPLOYMENT', true),
      mcpMonitoring: getEnvBool('VITE_FEATURE_MCP_MONITORING', true),
      mcpTemplates: getEnvBool('VITE_FEATURE_MCP_TEMPLATES', true),
      serverCloning: getEnvBool('VITE_FEATURE_SERVER_CLONING', false),
      bulkOperations: getEnvBool('VITE_FEATURE_BULK_OPERATIONS', false),
      customDomains: getEnvBool('VITE_FEATURE_CUSTOM_DOMAINS', false),
    },
    
    // Development settings
    dev: {
      debugMode: getEnvBool('VITE_DEBUG_MODE', environment === 'development'),
      mockApiEnabled: getEnvBool('VITE_MOCK_API_ENABLED', environment === 'development'),
      logLevel: (getEnvVar('VITE_LOG_LEVEL', 'info') as any) || 'info',
    },
    
    // Monitoring configuration
    monitoring: {
      sentryDsn: getEnvVar('VITE_SENTRY_DSN', '', environment !== 'production'), // Silent in dev
      performanceEnabled: getEnvBool('VITE_PERFORMANCE_MONITORING_ENABLED', true),
      analyticsEnabled: getEnvBool('VITE_ANALYTICS_ENABLED', true),
    },
  };
}

/**
 * Validate required environment variables
 */
function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];
  
  // Required in all environments
  if (!config.supabase.url) {
    errors.push('VITE_SUPABASE_URL is required');
  }
  
  if (!config.supabase.anonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY is required');
  }
  
  // Required in production
  if (config.isProduction) {
    if (!config.monitoring.sentryDsn) {
      errors.push('VITE_SENTRY_DSN is required in production');
    }
    
    if (config.dev.debugMode) {
      errors.push('Debug mode should be disabled in production');
    }
    
    if (config.dev.mockApiEnabled) {
      errors.push('Mock API should be disabled in production');
    }
  }
  
  // Validate URLs
  try {
    new URL(config.baseUrl);
  } catch {
    errors.push('VITE_APP_BASE_URL must be a valid URL');
  }
  
  try {
    new URL(config.apiBaseUrl);
  } catch {
    errors.push('VITE_API_BASE_URL must be a valid URL');
  }
  
  return errors;
}

/**
 * Application configuration instance
 */
export const config = buildConfig();

/**
 * Validate configuration on module load
 */
const configErrors = validateConfig(config);
if (configErrors.length > 0) {
  console.error('Configuration errors:');
  configErrors.forEach(error => console.error(`  - ${error}`));
  
  if (config.isProduction) {
    throw new Error('Invalid configuration in production environment');
  }
}

/**
 * Log configuration info (without sensitive data)
 */
if (config.dev.debugMode) {
  console.log('🔧 Application Configuration:', {
    environment: config.environment,
    baseUrl: config.baseUrl,
    apiBaseUrl: config.apiBaseUrl,
    features: config.features,
    dev: config.dev,
    monitoring: {
      performanceEnabled: config.monitoring.performanceEnabled,
      analyticsEnabled: config.monitoring.analyticsEnabled,
      sentryConfigured: !!config.monitoring.sentryDsn,
    },
  });
}

/**
 * Export configuration utilities
 */
export {
  getEnvVar,
  getEnvBool,
  getEnvNumber,
  getCurrentEnvironment,
  validateConfig,
};

/**
 * Export type-safe configuration access
 */
export default config; 