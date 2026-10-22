/**
 * DigitalOcean MCP Tools Implementation
 * Following MCP Application Layer Pattern
 * 
 * Based on MCP guidelines:
 * - Tools: Operations or functions the server can perform on request
 * - Tools have side effects or perform computations
 * - Enable the LLM to act as an agent that can affect external systems
 */

import { supabase } from '@/lib/supabase';
import { createDigitalOceanDroplet, listDigitalOceanDroplets, deleteDigitalOceanDroplet, getDropletById } from './digitalocean_service/droplets';

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  required_scopes: string[];
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface MCPToolExecutionContext {
  agentId: string;
  userId: string;
  tool: string;
  parameters: Record<string, any>;
}

/**
 * DigitalOcean MCP Tools Registry
 * Implements tools/list functionality
 */
export const DIGITALOCEAN_MCP_TOOLS: Record<string, MCPTool> = {
  list_droplets: {
    name: 'list_droplets',
    description: 'List all DigitalOcean droplets in the account',
    parameters: {
      type: 'object',
      properties: {
        tag_name: {
          type: 'string',
          description: 'Optional tag to filter droplets by',
        },
        name: {
          type: 'string',
          description: 'Optional name pattern to filter droplets by',
        }
      },
      required: []
    },
    required_scopes: ['droplet:read']
  },

  get_droplet: {
    name: 'get_droplet',
    description: 'Get details of a specific DigitalOcean droplet',
    parameters: {
      type: 'object',
      properties: {
        droplet_id: {
          type: 'integer',
          description: 'The ID of the droplet to retrieve',
        }
      },
      required: ['droplet_id']
    },
    required_scopes: ['droplet:read']
  },

  create_droplet: {
    name: 'create_droplet',
    description: 'Create a new DigitalOcean droplet',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the droplet',
        },
        region: {
          type: 'string',
          description: 'DigitalOcean region slug (e.g., nyc3, sfo3)',
        },
        size: {
          type: 'string',
          description: 'Droplet size slug (e.g., s-1vcpu-1gb, s-2vcpu-2gb)',
        },
        image: {
          type: 'string',
          description: 'Image slug or ID (e.g., ubuntu-22-04-x64)',
        },
        ssh_keys: {
          type: 'array',
          items: {
            type: 'integer'
          },
          description: 'Array of SSH key IDs to add to the droplet',
        },
        backups: {
          type: 'boolean',
          description: 'Enable automated backups',
          default: false
        },
        ipv6: {
          type: 'boolean',
          description: 'Enable IPv6 networking',
          default: false
        },
        monitoring: {
          type: 'boolean',
          description: 'Enable monitoring agent',
          default: false
        },
        tags: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of tags to apply to the droplet',
        }
      },
      required: ['name', 'region', 'size', 'image']
    },
    required_scopes: ['droplet:create']
  },

  delete_droplet: {
    name: 'delete_droplet',
    description: 'Delete a DigitalOcean droplet',
    parameters: {
      type: 'object',
      properties: {
        droplet_id: {
          type: 'integer',
          description: 'The ID of the droplet to delete',
        }
      },
      required: ['droplet_id']
    },
    required_scopes: ['droplet:delete']
  },

  list_images: {
    name: 'list_images',
    description: 'List available DigitalOcean images',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['distribution', 'application', 'user'],
          description: 'Filter images by type',
        },
        private: {
          type: 'boolean',
          description: 'Include private images',
          default: false
        }
      },
      required: []
    },
    required_scopes: ['image:read']
  },

  list_regions: {
    name: 'list_regions',
    description: 'List available DigitalOcean regions',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    required_scopes: ['region:read']
  },

  list_sizes: {
    name: 'list_sizes',
    description: 'List available DigitalOcean droplet sizes',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    required_scopes: ['size:read']
  }
};

/**
 * DigitalOcean MCP Tools Service
 * Handles tool execution with proper permission checking
 */
export class DigitalOceanMCPToolsService {
  /**
   * List available DigitalOcean MCP tools
   */
  static getAvailableTools(): MCPTool[] {
    return Object.values(DIGITALOCEAN_MCP_TOOLS);
  }

  /**
   * Execute a DigitalOcean MCP tool
   */
  static async executeTool(context: MCPToolExecutionContext): Promise<MCPToolResult> {
    const { agentId, userId, tool, parameters } = context;

    try {
      // Verify agent has permission to use DigitalOcean tools
      const hasPermission = await this.verifyAgentPermission(agentId, userId, tool);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Agent does not have permission to use DigitalOcean tools'
        };
      }

      // Get DigitalOcean API credentials for the user
      const credentials = await this.getDigitalOceanCredentials(userId);
      if (!credentials) {
        return {
          success: false,
          error: 'No DigitalOcean API credentials found for user'
        };
      }

      // Execute the specific tool
      switch (tool) {
        case 'list_droplets':
          return await this.executeListDroplets(parameters, credentials);
        
        case 'get_droplet':
          return await this.executeGetDroplet(parameters, credentials);
        
        case 'create_droplet':
          return await this.executeCreateDroplet(parameters, credentials);
        
        case 'delete_droplet':
          return await this.executeDeleteDroplet(parameters, credentials);
        
        case 'list_images':
          return await this.executeListImages(parameters, credentials);
        
        case 'list_regions':
          return await this.executeListRegions(parameters, credentials);
        
        case 'list_sizes':
          return await this.executeListSizes(parameters, credentials);
        
        default:
          return {
            success: false,
            error: `Unknown DigitalOcean tool: ${tool}`
          };
      }
    } catch (error: any) {
      console.error(`Error executing DigitalOcean tool ${tool}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to execute DigitalOcean tool'
      };
    }
  }

  /**
   * Verify agent has permission to use DigitalOcean tools
   */
  private static async verifyAgentPermission(agentId: string, userId: string, tool: string): Promise<boolean> {
    try {
      const { data: permissions, error } = await supabase
        .from('agent_integration_permissions')
        .select('allowed_scopes, is_active')
        .eq('agent_id', agentId)
        .eq('user_integration_credentials.user_id', userId)
        .eq('user_integration_credentials.service_providers.name', 'digitalocean')
        .eq('is_active', true)
        .single();

      if (error || !permissions) {
        return false;
      }

      // Check if agent has required scopes for the tool
      const requiredScopes = DIGITALOCEAN_MCP_TOOLS[tool]?.required_scopes || [];
      const allowedScopes = permissions.allowed_scopes || [];

      return requiredScopes.every(scope => allowedScopes.includes(scope));
    } catch (error) {
      console.error('Error verifying agent permission:', error);
      return false;
    }
  }

  /**
   * Get DigitalOcean API credentials for user
   */
  private static async getDigitalOceanCredentials(userId: string): Promise<string | null> {
    try {
      const { data: credential, error } = await supabase
        .from('user_integration_credentials')
        .select('vault_access_token_id')
        .eq('user_id', userId)
        .eq('service_providers.name', 'digitalocean')
        .eq('connection_status', 'active')
        .single();

      if (error || !credential?.vault_access_token_id) {
        return null;
      }

      // Retrieve API token from vault
      const { data: vaultData, error: vaultError } = await supabase.rpc('get_vault_secret', {
        p_secret_id: credential.vault_access_token_id
      });

      if (vaultError || !vaultData) {
        return null;
      }

      return vaultData;
    } catch (error) {
      console.error('Error getting DigitalOcean credentials:', error);
      return null;
    }
  }

  /**
   * Execute list_droplets tool
   */
  private static async executeListDroplets(parameters: any, apiToken: string): Promise<MCPToolResult> {
    try {
      const droplets = await listDigitalOceanDroplets({
        apiKey: apiToken,
        tag_name: parameters.tag_name,
        name: parameters.name
      });

      return {
        success: true,
        data: droplets,
        metadata: {
          count: droplets?.length || 0,
          tool: 'list_droplets'
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to list droplets'
      };
    }
  }

  /**
   * Execute get_droplet tool
   */
  private static async executeGetDroplet(parameters: any, apiToken: string): Promise<MCPToolResult> {
    try {
      const droplet = await getDropletById(parameters.droplet_id, apiToken);

      return {
        success: true,
        data: droplet,
        metadata: {
          tool: 'get_droplet',
          droplet_id: parameters.droplet_id
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get droplet'
      };
    }
  }

  /**
   * Execute create_droplet tool
   */
  private static async executeCreateDroplet(parameters: any, apiToken: string): Promise<MCPToolResult> {
    try {
      const dropletResult = await createDigitalOceanDroplet({
        apiKey: apiToken,
        name: parameters.name,
        region: parameters.region,
        size: parameters.size,
        image: parameters.image,
        ssh_keys: parameters.ssh_keys,
        backups: parameters.backups,
        ipv6: parameters.ipv6,
        monitoring: parameters.monitoring,
        tags: parameters.tags
      });

      return {
        success: true,
        data: dropletResult,
        metadata: {
          tool: 'create_droplet',
          droplet_name: parameters.name
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create droplet'
      };
    }
  }

  /**
   * Execute delete_droplet tool
   */
  private static async executeDeleteDroplet(parameters: any, apiToken: string): Promise<MCPToolResult> {
    try {
      await deleteDigitalOceanDroplet(parameters.droplet_id, apiToken);

      return {
        success: true,
        data: { droplet_id: parameters.droplet_id, status: 'deleted' },
        metadata: {
          tool: 'delete_droplet',
          droplet_id: parameters.droplet_id
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to delete droplet'
      };
    }
  }

  /**
   * Execute list_images tool
   */
  private static async executeListImages(parameters: any, apiToken: string): Promise<MCPToolResult> {
    try {
      // This would need to be implemented in the DigitalOcean service
      // For now, return a placeholder
      return {
        success: false,
        error: 'list_images tool not yet implemented'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to list images'
      };
    }
  }

  /**
   * Execute list_regions tool
   */
  private static async executeListRegions(parameters: any, apiToken: string): Promise<MCPToolResult> {
    try {
      // This would need to be implemented in the DigitalOcean service
      // For now, return a placeholder
      return {
        success: false,
        error: 'list_regions tool not yet implemented'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to list regions'
      };
    }
  }

  /**
   * Execute list_sizes tool
   */
  private static async executeListSizes(parameters: any, apiToken: string): Promise<MCPToolResult> {
    try {
      // This would need to be implemented in the DigitalOcean service
      // For now, return a placeholder
      return {
        success: false,
        error: 'list_sizes tool not yet implemented'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to list sizes'
      };
    }
  }
}
