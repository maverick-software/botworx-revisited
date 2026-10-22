// src/lib/mcp/transport.ts
// Placeholder - Requires implementation using Deno WebSocket API
// and JSON-RPC 2.0 formatting/parsing logic.

// Consider using a library like 'json-rpc-2.0' if dependencies are acceptable.

// Import custom error type from within the function directory
import { MCPRequestError } from './errors.ts';

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number | string;
    method: string;
    params?: any[] | object;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number | string | null;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

export class MCPTransport {
    private ws: WebSocket | null = null;
    private endpointUrl: string;
    private connectionPromise: Promise<void> | null = null;
    private pendingRequests: Map<number | string, { resolve: (value: any) => void; reject: (reason?: any) => void; method: string }> = new Map();
    private messageIdCounter = 0;

    constructor(url: string) {
        this.endpointUrl = url;
    }

    async connect(): Promise<void> {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`MCPTransport: Already connected to ${this.endpointUrl}.`);
            return Promise.resolve();
        }

        if (this.connectionPromise) {
            console.log(`MCPTransport: Connection attempt already in progress for ${this.endpointUrl}.`);
            return this.connectionPromise;
        }

        console.log(`MCPTransport: Attempting WebSocket connection to ${this.endpointUrl}...`);
        this.connectionPromise = new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.endpointUrl);

                this.ws.onopen = () => {
                    console.log(`MCPTransport: WebSocket connected successfully to ${this.endpointUrl}`);
                    this.connectionPromise = null;
                    resolve();
                };

                this.ws.onerror = (event) => {
                    console.error(`MCPTransport: WebSocket error for ${this.endpointUrl}. Event:`, event);
                    this.connectionPromise = null;
                    this.ws = null;
                    reject(new Error('WebSocket connection error'));
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onclose = (event) => {
                    console.log(`MCPTransport: WebSocket disconnected from ${this.endpointUrl}. Code: ${event.code}, Reason: ${event.reason}`);
                    const closeError = new Error(`WebSocket connection closed (Code: ${event.code})`);
                    this.pendingRequests.forEach(({ reject }) => reject(closeError));
                    this.pendingRequests.clear();
                    this.ws = null;
                    this.connectionPromise = null; // Ensure promise is cleared on close
                    // NOTE: Reconnection logic is handled by MCPClient retries
                };
            } catch (error) {
                console.error(`MCPTransport: Failed to initiate WebSocket connection to ${this.endpointUrl}:`, error);
                this.connectionPromise = null;
                reject(error);
            }
        });

        return this.connectionPromise;
    }

    disconnect(): void {
        if (this.ws) {
            console.log(`MCPTransport: Explicitly disconnecting WebSocket from ${this.endpointUrl}`);
            this.ws.onclose = null; // Prevent onclose handler from firing during explicit disconnect
            this.ws.close(1000, "Client initiated disconnect"); // Use code 1000 for normal closure
            this.ws = null;
        }
        const disconnectError = new Error('Transport disconnected by client');
        this.pendingRequests.forEach(({ reject }) => reject(disconnectError));
        this.pendingRequests.clear();
        this.connectionPromise = null; // Clear any pending connection promise
    }

    async sendRequest(method: string, params?: any[] | object): Promise<any> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
             console.log(`MCPTransport: Not connected to ${this.endpointUrl}, attempting connection before sending request '${method}'`);
             await this.connect(); // Attempt to connect/wait for connection
             if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                console.error(`MCPTransport: Failed to connect, cannot send request '${method}' to ${this.endpointUrl}`);
                throw new Error(`MCPTransport: Cannot send request '${method}', connection failed or closed.`);
             }
             console.log(`MCPTransport: Connection established, proceeding with request '${method}' to ${this.endpointUrl}`);
        }

        const id = this.messageIdCounter++;
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };

        const requestJson = JSON.stringify(request);

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject, method });
            try {
                 console.log(`MCPTransport: --> Sending request (ID: ${id}, Method: ${method}) to ${this.endpointUrl}`);
                 // Optional: Log params if not sensitive
                 // console.log(`MCPTransport: Request params (ID: ${id}):`, params);
                this.ws!.send(requestJson);
                // TODO: Implement request timeout logic here?
            } catch (error) {
                console.error(`MCPTransport: Error sending request (ID: ${id}, Method: ${method}) to ${this.endpointUrl}:`, error);
                this.pendingRequests.delete(id);
                reject(error);
            }
        });
    }

    private handleMessage(data: any): void {
         console.log(`MCPTransport: <-- Received raw message from ${this.endpointUrl}:`, data);
        try {
            const response: JsonRpcResponse = JSON.parse(data);

            if (response.id !== null && this.pendingRequests.has(response.id)) {
                const { resolve, reject, method } = this.pendingRequests.get(response.id)!;
                this.pendingRequests.delete(response.id);

                if (response.error) {
                    console.error(`MCPTransport: <-- Received error response (ID: ${response.id}, Method: ${method}) from ${this.endpointUrl}:`, response.error);
                    reject(new MCPRequestError(`MCP Error ${response.error.code}: ${response.error.message}`, response.error.code, response.error.data));
                } else {
                     console.log(`MCPTransport: <-- Received successful result (ID: ${response.id}, Method: ${method}) from ${this.endpointUrl}`);
                     // Optional: Log result if not sensitive
                     // console.log(`MCPTransport: Response result (ID: ${response.id}):`, response.result);
                    resolve(response.result);
                }
            } else {
                 // Handle notifications or mismatched IDs
                 if (response.id === null && response.method) {
                    console.log(`MCPTransport: <-- Received notification (Method: ${response.method}) from ${this.endpointUrl}`);
                    // TODO: Implement notification handling if required by MCP spec or servers
                 } else {
                    console.warn(`MCPTransport: <-- Received message with unknown or missing ID from ${this.endpointUrl}:`, response);
                 }
            }
        } catch (error) {
            console.error(`MCPTransport: Error parsing incoming JSON message from ${this.endpointUrl}:`, error, 'Raw Data:', data);
        }
    }

    isConnected(): boolean {
        return !!this.ws && this.ws.readyState === WebSocket.OPEN;
    }
} 