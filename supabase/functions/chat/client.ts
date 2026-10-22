import { MCPTransport } from './transport.ts';
import { MCPServerConfig, MCPServerCapabilities, MCPClientInformation, MCPHostInformation, AgentopiaContextData, MCPClientCapabilities, AgentopiaContextResource } from './types.ts';
import { MCPConnectionError, MCPHandshakeError, MCPTimeoutError, MCPRequestError, MCPError } from './errors.ts'; // Ensure path is local
// TODO: Import logger type if using a shared logger

// Placeholder for getting Agentopia version, etc.
const AGENTOPIA_VERSION = '0.1.0'; // Replace with actual versioning
const CONNECTOR_VERSION = '0.1.0';

const DEFAULT_CLIENT_INFO: MCPClientInformation = {
    name: 'Agentopia-MCP-Connector',
    version: CONNECTOR_VERSION,
};

// Placeholder - This should be passed in or dynamically determined
const DEFAULT_HOST_INFO: MCPHostInformation = {
    name: 'Agentopia',
    version: AGENTOPIA_VERSION,
};

export class MCPClient {
    private config: MCPServerConfig & { api_key?: string | null };
    private transport: MCPTransport;
    private capabilities: MCPServerCapabilities | null = null;
    private hostInfo: MCPHostInformation;
    private clientInfo: MCPClientInformation;
    private logPrefix: string;

    constructor(config: MCPServerConfig & { api_key?: string | null }, hostInfo: MCPHostInformation = DEFAULT_HOST_INFO, clientInfo: MCPClientInformation = DEFAULT_CLIENT_INFO /*, logger: Logger */) {
        this.config = config;
        this.hostInfo = hostInfo;
        this.clientInfo = clientInfo;
        this.logPrefix = `[MCPClient:${config.name}(${config.id})]`;
        this.transport = new MCPTransport(config.endpoint_url);
        console.log(`${this.logPrefix} Initialized. Endpoint: ${config.endpoint_url}`);
    }

    /**
     * Connects to the server, performs handshake, and negotiates capabilities.
     * Manages retries based on config.
     */
    async connect(): Promise<MCPServerCapabilities> {
        console.log(`${this.logPrefix} connect() called.`);
        if (this.capabilities && this.transport.isConnected()) {
            console.log(`${this.logPrefix} Already connected and capabilities known.`);
            return this.capabilities;
        }

        let attempts = 0;
        const maxAttempts = this.config.max_retries + 1;

        while (attempts < maxAttempts) {
            attempts++;
            console.log(`${this.logPrefix} Connection attempt ${attempts}/${maxAttempts}...`);
            try {
                const result = await this.withTimeout(async () => {
                    console.log(`${this.logPrefix} Attempt ${attempts}: Establishing WebSocket connection...`);
                    await this.transport.connect();
                    console.log(`${this.logPrefix} Attempt ${attempts}: WebSocket connected. Performing handshake...`);

                    const initializeParams = {
                        processId: null,
                        clientInfo: this.clientInfo,
                        hostInfo: this.hostInfo,
                        capabilities: {} as MCPClientCapabilities,
                        // Include API key in initialization if provided in config
                        authentication: this.config.api_key ? { apiKey: this.config.api_key } : undefined,
                    };
                    console.log(`${this.logPrefix} Attempt ${attempts}: Sending 'initialize' request...`);
                    // IMPORTANT: DO NOT log initializeParams if they contain sensitive data like API keys

                    const initResult = await this.transport.sendRequest('initialize', initializeParams);
                    console.log(`${this.logPrefix} Attempt ${attempts}: Received 'initialize' response.`);

                    if (!initResult || typeof initResult !== 'object' || !initResult.capabilities || typeof initResult.capabilities !== 'object') {
                        console.error(`${this.logPrefix} Attempt ${attempts}: Invalid 'initialize' response structure:`, initResult);
                        throw new MCPHandshakeError('Invalid initialize response structure', initResult);
                    }

                    this.capabilities = initResult.capabilities as MCPServerCapabilities;
                    console.log(`${this.logPrefix} Attempt ${attempts}: Handshake successful. Server capabilities received:`, this.capabilities);
                    return this.capabilities;
                }, this.config.timeout_ms * 2); // Use a longer timeout for combined connect+handshake

                return result; // Success, return capabilities

            } catch (error) {
                console.error(`${this.logPrefix} Connection attempt ${attempts} failed:`, error);
                this.disconnect(); // Ensure cleanup before potential retry

                if (attempts >= maxAttempts) {
                     console.error(`${this.logPrefix} Max connection attempts (${maxAttempts}) reached. Giving up.`);
                     // Throw specific error based on the caught error type
                     if (error instanceof MCPTimeoutError) throw error;
                     if (error instanceof MCPHandshakeError) throw error;
                     if (error instanceof MCPError) throw error; // Catch other MCP errors
                     throw new MCPConnectionError(`Failed to connect after ${maxAttempts} attempts: ${error.message}`, error);
                }

                // Determine delay and retry
                const delay = this.config.retry_backoff_ms * Math.pow(2, attempts - 1); // Exponential backoff
                console.log(`${this.logPrefix} Retrying connection in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        // Should not be reachable due to throw in catch block, but satisfies TS
        throw new MCPConnectionError(`${this.logPrefix} Failed to connect after ${maxAttempts} attempts.`);
    }

    /**
     * Disconnects the underlying transport.
     */
    disconnect(): void {
        console.log(`${this.logPrefix} disconnect() called.`);
        this.transport.disconnect();
        this.capabilities = null;
        console.log(`${this.logPrefix} Disconnected.`);
    }

    /**
     * Sends context data to the server using appropriate MCP methods based on capabilities.
     * Assumes connection is established.
     */
    async sendContext(contextData: AgentopiaContextData[]): Promise<any> {
        console.log(`${this.logPrefix} sendContext() called with ${contextData.length} context items.`);
        if (!this.capabilities || !this.transport.isConnected()) {
             console.log(`${this.logPrefix} Not connected or capabilities unknown. Ensuring connection before sending context...`);
             try {
                await this.connect();
             } catch (connectError) {
                 console.error(`${this.logPrefix} Connection failed before sending context:`, connectError);
                 throw new MCPConnectionError(`Cannot send context, connection failed: ${connectError.message}`, connectError);
             }
        }
        console.log(`${this.logPrefix} Connection ready. Determining send method based on capabilities:`, this.capabilities);

        // TODO: Make this more robust based on capability details
        const sendMethod = this.capabilities?.resources ? 'mcp/provideResources' : null;

        if (!sendMethod) {
            console.warn(`${this.logPrefix} Server does not support a known context sending method (e.g., mcp/provideResources). Cannot send context.`);
            // Returning null or an empty object might be appropriate depending on how the manager handles it.
            // Throwing an error might be too aggressive if context providing is optional.
            return null;
        }

        // Prepare parameters, potentially filtering/transforming based on capabilities
        const resourceParams = { resources: contextData }; // Basic implementation
        console.log(`${this.logPrefix} Prepared parameters for method '${sendMethod}'.`); // Avoid logging contextData directly if large/sensitive

        // Simple retry for send operation
        let attempts = 0;
        const maxAttempts = 2; // Retry send once on failure (configurable?)
        while(attempts < maxAttempts) {
            attempts++;
            console.log(`${this.logPrefix} Sending '${sendMethod}' request (Attempt ${attempts}/${maxAttempts})...`);
            try {
                const response = await this.withTimeout(
                    () => this.transport.sendRequest(sendMethod, resourceParams),
                    this.config.timeout_ms
                );
                console.log(`${this.logPrefix} Received response for '${sendMethod}' (Attempt ${attempts}).`);
                // Optional: Log response summary if needed
                return response;
            } catch (error) {
                console.error(`${this.logPrefix} Error sending context via '${sendMethod}' (Attempt ${attempts}):`, error);
                if (attempts >= maxAttempts || error instanceof MCPTimeoutError) {
                     console.error(`${this.logPrefix} Final attempt failed or timed out for '${sendMethod}'. Giving up.`);
                     if (error instanceof MCPTimeoutError) throw error;
                     if (error instanceof MCPError) throw error; // Re-throw specific MCP errors
                     throw new MCPRequestError(`Failed to send context after ${attempts} attempts: ${error.message}`);
                }
                // Optional: Wait before retrying send?
                // const sendRetryDelay = 500;
                // console.log(`${this.logPrefix} Retrying send in ${sendRetryDelay}ms...`);
                // await new Promise(resolve => setTimeout(resolve, sendRetryDelay));
            }
        }
        // Should not be reachable
        throw new MCPRequestError(`${this.logPrefix} Failed to send context via '${sendMethod}' after ${maxAttempts} attempts.`);
    }

    /**
     * Returns the negotiated server capabilities.
     */
    getServerCapabilities(): MCPServerCapabilities | null {
        return this.capabilities;
    }

    /**
     * Gets the underlying transport connection status.
     */
    isConnected(): boolean {
        return this.transport.isConnected();
    }

     /**
     * Sends a test request (e.g., ping or basic method) to verify connection.
     * Used by the /test endpoint.
     */
     async testConnection(): Promise<{ success: boolean; message: string; capabilities?: MCPServerCapabilities }> {
        console.log(`${this.logPrefix} testConnection() called.`);
        try {
            // Attempt to connect and perform initialize handshake
            const caps = await this.connect(); // connect() handles logging and retries
            console.log(`${this.logPrefix} testConnection: Connect and handshake successful.`);

            // Optionally, send a simple follow-up request if the server supports it (e.g., a custom 'mcp/ping')
            // try {
            //     console.log(`${this.logPrefix} testConnection: Sending optional ping...`);
            //     const pingResult = await this.withTimeout(() => this.transport.sendRequest('mcp/ping', {}), this.config.timeout_ms);
            //     console.log(`${this.logPrefix} testConnection: Ping successful. Result:`, pingResult);
            // } catch (pingError) {
            //     console.warn(`${this.logPrefix} testConnection: Optional ping failed (this might be ok):`, pingError);
            // }

            // Disconnect after successful test to free resources immediately
            console.log(`${this.logPrefix} testConnection: Test successful, disconnecting.`);
            this.disconnect();

            return { success: true, message: 'Connection and handshake successful.', capabilities: caps };
        } catch (error) {
            console.error(`${this.logPrefix} testConnection failed:`, error);
            // Ensure disconnected on failure too
            this.disconnect();
            return { success: false, message: `Test connection failed: ${error.message}` };
        }
     }

    /** Helper to add timeout to promises */
    private withTimeout<T>(promise: () => Promise<T>, ms: number): Promise<T> {
        console.log(`${this.logPrefix} Setting timeout of ${ms}ms.`);
        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                console.warn(`${this.logPrefix} Operation timed out after ${ms}ms.`);
                reject(new MCPTimeoutError(`Operation timed out after ${ms}ms`));
            }, ms);

            try {
                const result = await promise();
                clearTimeout(timer);
                resolve(result);
            } catch (error) {
                clearTimeout(timer);
                // Don't log error here, let the caller handle logging the specific operation failure
                reject(error);
            }
        });
    }
} 