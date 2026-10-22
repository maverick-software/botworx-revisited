// src/lib/mcp/manager.ts
import { MCPClient } from './client.ts';
import { MCPServerConfig, GofrAgentsContextData, AggregatedMCPResults, ServerResourceUpdate, MCPServerCapabilities } from './types.ts';
// TODO: Import logger type

/**
 * Manages interactions with one or more MCP-compliant servers for a given agent context.
 * Processes context data by sending it to configured Toolboxes/Deployed Services sequentially based on priority.
 * Aggregates results (e.g., enriched context, tool calls) from these services.
 * This manager will be significantly refactored to work with the new Toolbox/DTMA architecture.
 */
export class MCPManager {
    private configs: (MCPServerConfig & { api_key?: string | null })[];
    private clients: Map<number, MCPClient>; // Map server ID to client instance
    private logPrefix = '[MCPManager]';

    constructor(serverConfigs: (MCPServerConfig & { api_key?: string | null })[] /*, logger: Logger */) {
        // Filter only active servers and sort by priority (ascending)
        this.configs = serverConfigs
            .filter(c => c.is_active)
            .sort((a, b) => a.priority - b.priority);
        this.clients = new Map();
        // this.logger = logger;
        console.log(`${this.logPrefix} Initialized with ${this.configs.length} active server configurations.`);
        if (this.configs.length > 0) {
             console.log(`${this.logPrefix} Server processing order (by priority):`, this.configs.map(c => `${c.name}(${c.id})`));
        }
    }

    /**
     * Processes context data by sending it to configured Toolboxes/Deployed Services sequentially based on priority.
     * Aggregates results.
     */
    async processContext(contextData: GofrAgentsContextData[]): Promise<AggregatedMCPResults> {
        console.log(`${this.logPrefix} processContext() called with ${contextData.length} context items.`);
        const aggregatedResults: AggregatedMCPResults = {
            resources: [],
            errors: [],
        };

        if (this.configs.length === 0) {
            console.log(`${this.logPrefix} No active servers configured. Skipping MCP processing.`);
            return aggregatedResults;
        }

        for (const config of this.configs) {
            console.log(`${this.logPrefix} Processing server: ${config.name} (ID: ${config.id}, Priority: ${config.priority})`);
            try {
                const client = this.getClient(config);
                console.log(`${this.logPrefix} Ensuring connection for server ${config.name}...`);
                await client.connect(); // connect() is idempotent and handles logging/retries
                console.log(`${this.logPrefix} Connection ensured for server ${config.name}.`);

                const capabilities = client.getServerCapabilities();
                console.log(`${this.logPrefix} Filtering context for server ${config.name} based on capabilities:`, capabilities);
                const relevantContext = this.filterContextForServer(contextData, capabilities);

                if (relevantContext.length > 0) {
                     console.log(`${this.logPrefix} Sending ${relevantContext.length} relevant context items to server ${config.name}...`);
                     const response = await client.sendContext(relevantContext);
                     console.log(`${this.logPrefix} Received response from server ${config.name}. Aggregating...`);
                     this.aggregateResponse(response, aggregatedResults, config.id);
                     console.log(`${this.logPrefix} Aggregation complete for server ${config.name}.`);
                } else {
                     console.log(`${this.logPrefix} No relevant context determined for server ${config.name}. Skipping send.`);
                }

            } catch (error: any) {
                // Ensure we always have an Error object
                const e = error instanceof Error ? error : new Error(String(error));
                console.error(`${this.logPrefix} Error processing server ${config.name} (ID: ${config.id}):`, e);
                aggregatedResults.errors.push({ serverId: config.id, error: e });
                // Continue with the next server even if one fails
                console.log(`${this.logPrefix} Continuing to next server after error.`);
            }
        }

         console.log(`${this.logPrefix} Finished processing all ${this.configs.length} servers.`);
         console.log(`${this.logPrefix} Aggregated results: ${aggregatedResults.resources.length} resources, ${aggregatedResults.errors.length} errors.`);
        return aggregatedResults;
    }

    /**
     * Retrieves or creates an MCPClient instance for a given configuration.
     */
    private getClient(config: MCPServerConfig & { api_key?: string | null }): MCPClient {
        if (!this.clients.has(config.id)) {
            console.log(`${this.logPrefix} Creating new MCPClient instance for server ${config.name} (ID: ${config.id})`);
            // TODO: Pass logger if using one
            this.clients.set(config.id, new MCPClient(config));
        }
        return this.clients.get(config.id)!;
    }

    /**
     * Filters context data based on server capabilities.
     */
    private filterContextForServer(
        allContext: GofrAgentsContextData[],
        capabilities: MCPServerCapabilities | null
    ): GofrAgentsContextData[] {
        console.log(`${this.logPrefix} filterContextForServer called. Capabilities:`, capabilities);
        if (!capabilities || !capabilities.resources) {
             console.warn(`${this.logPrefix} Server does not advertise resource support ('capabilities.resources' is falsy). Sending no context.`);
            return [];
        }

        // Example capability structure check:
        // capabilities.resources = { supportedTypes: ['conversationHistory', 'agentContext', 'userInput'] }
        let supportedTypes: Set<string>;
        if (typeof capabilities.resources === 'object' && Array.isArray((capabilities.resources as any).supportedTypes)) {
            supportedTypes = new Set((capabilities.resources as any).supportedTypes as string[]);
             console.log(`${this.logPrefix} Server explicitly supports resource types:`, Array.from(supportedTypes));
        } else if (capabilities.resources === true) {
            // If `resources: true`, assume it supports all known Gofr Agents types by default
            supportedTypes = new Set(['agentContext', 'conversationHistory', 'userInput']);
             console.log(`${this.logPrefix} Server has 'resources: true'. Assuming support for default types:`, Array.from(supportedTypes));
        } else {
             console.warn(`${this.logPrefix} Unknown structure for 'capabilities.resources'. Assuming no support. Value:`, capabilities.resources);
             return [];
        }

        const filteredContext = allContext.filter(contextItem => {
            if (supportedTypes.has(contextItem.type)) {
                 console.log(`${this.logPrefix} Including context type '${contextItem.type}'.`);
                // TODO: Add further filtering (e.g., history length)
                return true;
            } else {
                 console.log(`${this.logPrefix} Excluding context type '${contextItem.type}' as it's not in supported types.`);
                return false;
            }
        });
        console.log(`${this.logPrefix} Filtering resulted in ${filteredContext.length} context items.`);
        return filteredContext;
    }

    /**
     * Parses server response and adds relevant parts to aggregated results.
     */
    private aggregateResponse(response: any, results: AggregatedMCPResults, serverId: number): void {
         console.log(`${this.logPrefix} aggregateResponse called for server ${serverId}. Response:`, response);
        // TODO: Implement more robust response parsing based on MCP spec and expected structures.
        if (response && typeof response === 'object') {
            // Example: Look for a standard 'resources' array in the response
            if (Array.isArray(response.resources)) {
                const validResources = response.resources.filter((r: any) => r && r.type && r.id && r.content) as ServerResourceUpdate[];
                if (validResources.length > 0) {
                     console.log(`${this.logPrefix} Adding ${validResources.length} valid resources from server ${serverId} response.`);
                     results.resources.push(...validResources);
                }
                 if (validResources.length !== response.resources.length) {
                     console.warn(`${this.logPrefix} Some items in the response resources array from server ${serverId} were invalid or incomplete.`);
                 }
            } else {
                 console.log(`${this.logPrefix} No 'resources' array found in the response from server ${serverId}.`);
             }
            // TODO: Look for other potential response structures (e.g., prompt modifications, tool calls) if defined by MCP/servers.

        } else {
             console.log(`${this.logPrefix} Response from server ${serverId} was null or not an object. Cannot aggregate.`);
         }
    }

    /**
     * Disconnects all managed clients.
     */
    disconnectAll(): void {
         console.log(`${this.logPrefix} disconnectAll() called. Disconnecting ${this.clients.size} clients...`);
        this.clients.forEach((client, serverId) => {
            console.log(`${this.logPrefix} Disconnecting client for server ID ${serverId}...`);
            client.disconnect();
        });
        this.clients.clear();
         console.log(`${this.logPrefix} All clients disconnected and map cleared.`);
    }
} 