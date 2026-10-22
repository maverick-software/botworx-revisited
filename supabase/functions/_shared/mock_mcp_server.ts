// supabase/functions/_shared/mock_mcp_server.ts
// A simple mock MCP server for integration testing

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { MCPServerCapabilities } from "../../../src/lib/mcp/types.ts"; // Adjust path as needed
import { JsonRpcRequest, JsonRpcResponse } from "../../../src/lib/mcp/transport.ts"; // Adjust path as needed

interface MockServerOptions {
    port?: number;
    host?: string;
    capabilities?: MCPServerCapabilities;
    sendResources?: any[]; // Resources to send back on provideResources call
    initializeShouldError?: boolean;
    provideResourcesShouldError?: boolean;
    logPrefix?: string;
}

export class MockMCPServer {
    private port: number;
    private host: string;
    private capabilities: MCPServerCapabilities;
    private sendResources: any[];
    private initializeShouldError: boolean;
    private provideResourcesShouldError: boolean;
    private logPrefix: string;
    private abortController: AbortController | null = null;
    public receivedRequests: JsonRpcRequest[] = [];
    public connections: Set<WebSocket> = new Set();

    constructor(options: MockServerOptions = {}) {
        this.port = options.port ?? 8081; // Default port for mock server
        this.host = options.host ?? "localhost";
        this.capabilities = options.capabilities ?? { resources: true, prompts: false, tools: false };
        this.sendResources = options.sendResources ?? [{ type: 'mockResource', id: 'mock1', content: 'Mock data from server' }];
        this.initializeShouldError = options.initializeShouldError ?? false;
        this.provideResourcesShouldError = options.provideResourcesShouldError ?? false;
        this.logPrefix = options.logPrefix ?? "[MockMCPServer]";
        console.log(`${this.logPrefix} Initialized with options:`, options);
    }

    private handleWs(ws: WebSocket) {
        console.log(`${this.logPrefix} Client connected.`);
        this.connections.add(ws);

        ws.onmessage = (event) => {
            console.log(`${this.logPrefix} <-- Received message:`, event.data);
            try {
                const request = JSON.parse(event.data) as JsonRpcRequest;
                this.receivedRequests.push(request);
                let response: JsonRpcResponse;

                switch (request.method) {
                    case 'initialize':
                        if (this.initializeShouldError) {
                            response = {
                                jsonrpc: "2.0",
                                id: request.id,
                                error: { code: -32000, message: "Mock Server: Initialization forced error" }
                            };
                        } else {
                            response = {
                                jsonrpc: "2.0",
                                id: request.id,
                                result: { capabilities: this.capabilities }
                            };
                        }
                        break;
                    
                    case 'initialized': // Notification, no response needed
                         console.log(`${this.logPrefix} Received 'initialized' notification.`);
                         return; // Don't send a response

                    case 'mcp/provideResources':
                        if (this.provideResourcesShouldError) {
                             response = {
                                jsonrpc: "2.0",
                                id: request.id,
                                error: { code: -32001, message: "Mock Server: provideResources forced error" }
                            };
                        } else {
                             response = {
                                jsonrpc: "2.0",
                                id: request.id,
                                result: { resources: this.sendResources } // Send mock resources back
                            };
                        }
                        break;

                    default:
                        console.warn(`${this.logPrefix} Unknown method received: ${request.method}`);
                        response = {
                            jsonrpc: "2.0",
                            id: request.id,
                            error: { code: -32601, message: "Method not found" }
                        };
                }
                
                if (ws.readyState === WebSocket.OPEN) {
                    const responseStr = JSON.stringify(response);
                    console.log(`${this.logPrefix} --> Sending response:`, responseStr);
                    ws.send(responseStr);
                } else {
                    console.warn(`${this.logPrefix} WebSocket not open, cannot send response for id ${request.id}`);
                }

            } catch (e) {
                console.error(`${this.logPrefix} Error handling message:`, e);
                // Attempt to send JSON-RPC parse error if possible
                try {
                     if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
                     }
                } catch { /* Ignore send error */ }
            }
        };

        ws.onclose = () => {
            console.log(`${this.logPrefix} Client disconnected.`);
            this.connections.delete(ws);
        };

        ws.onerror = (e) => {
            console.error(`${this.logPrefix} WebSocket error:`, e instanceof ErrorEvent ? e.message : e);
            this.connections.delete(ws);
        };
    }

    async start() {
        if (this.abortController) {
            console.warn(`${this.logPrefix} Server already starting or started.`);
            return;
        }
        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        console.log(`${this.logPrefix} Starting mock server on ws://${this.host}:${this.port}...`);
        
        try {
            await serve( (req) => {
                if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
                    const { socket, response } = Deno.upgradeWebSocket(req);
                    this.handleWs(socket);
                    return response;
                } else {
                    return new Response("MCP Mock Server: Please connect via WebSocket.", { status: 400 });
                }
            }, { 
                port: this.port, 
                hostname: this.host, 
                signal: signal, 
                onListen: ({ hostname, port }) => {
                     console.log(`${this.logPrefix} Listening on ws://${hostname}:${port}`);
                }
            });
             console.log(`${this.logPrefix} Server stopped cleanly.`);
        } catch (e) {
            if (e.name === 'AbortError') {
                console.log(`${this.logPrefix} Server aborted successfully.`);
            } else {
                console.error(`${this.logPrefix} Server error:`, e);
            }
        } finally {
             this.abortController = null; 
             this.connections.forEach(ws => ws.close(1001, "Server shutting down"));
             this.connections.clear();
             this.receivedRequests = [];
        }
    }

    stop() {
        console.log(`${this.logPrefix} Stopping server...`);
        if (this.abortController) {
            this.abortController.abort();
        } else {
             console.log(`${this.logPrefix} Server not running.`);
        }
    }
} 