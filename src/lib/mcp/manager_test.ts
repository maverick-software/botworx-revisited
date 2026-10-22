// Test file for src/lib/mcp/manager.ts

import {
    assert,
    assertEquals,
    assertExists
} from "https://deno.land/std@0.217.0/assert/mod.ts";
import { delay } from "https://deno.land/std@0.217.0/async/delay.ts";
import { MCPManager } from './manager.ts';
import { MCPClient } from './client.ts';
import { MCPServerConfig, MCPServerCapabilities, GofrAgentsContextData, ServerResourceUpdate } from './types.ts';
import { MCPConnectionError } from './errors.ts';

// --- Mock MCPClient --- 

let clientInstanceCount = 0;
const clientInstances: MockMCPClient[] = [];

class MockMCPClient {
    config: MCPServerConfig & { api_key?: string | null };
    id: number;
    _isConnected: boolean = false;
    connectAttempts: number = 0;
    disconnectAttempts: number = 0;
    sendContextAttempts: number = 0;
    sendContextArgs: GofrAgentsContextData[][] = [];
    _capabilities: MCPServerCapabilities | null = null;
    _connectShouldError: Error | null = null;
    _sendContextShouldError: Error | null = null;
    _sendContextResponse: any = null;

    constructor(config: MCPServerConfig & { api_key?: string | null }) {
        this.config = config;
        this.id = config.id; 
        clientInstanceCount++;
        clientInstances.push(this);
    }

    async connect(): Promise<MCPServerCapabilities> {
        this.connectAttempts++;
        await delay(1);
        if (this._connectShouldError) {
            this._isConnected = false;
            throw this._connectShouldError;
        }
        this._isConnected = true;
        // Use capabilities set in mock config, default if null
        return this._capabilities ?? { resources: true }; 
    }

    disconnect(): void {
        this.disconnectAttempts++;
        this._isConnected = false;
    }

    async sendContext(contextData: GofrAgentsContextData[]): Promise<any> {
        this.sendContextAttempts++;
        this.sendContextArgs.push(contextData);
        await delay(1);
        if (!this._isConnected) {
             throw new Error("MockClient: Not connected");
        }
        if (this._sendContextShouldError) {
            throw this._sendContextShouldError;
        }
        return structuredClone(this._sendContextResponse); // Return clone
    }

    getServerCapabilities(): MCPServerCapabilities | null {
        // Return capabilities potentially set during mock connect
        return this._capabilities ?? (this._isConnected ? { resources: true } : null);
    }

    isConnected(): boolean {
        return this._isConnected;
    }

    // --- Mock configuration methods ---
    setConnectShouldError(error: Error | null) {
        this._connectShouldError = error;
    }
    setSendContextShouldError(error: Error | null) {
        this._sendContextShouldError = error;
    }
    setSendContextResponse(response: any) {
        this._sendContextResponse = response;
    }
     setCapabilities(caps: MCPServerCapabilities | null) {
         this._capabilities = caps;
     }
    resetMockState() {
        this.connectAttempts = 0;
        this.disconnectAttempts = 0;
        this.sendContextAttempts = 0;
        this.sendContextArgs = [];
        this._isConnected = false;
        this._connectShouldError = null;
        this._sendContextShouldError = null;
        this._sendContextResponse = null;
        this._capabilities = null;
    }

    // --- Static Mock Reset ---
    static resetAll() {
        clientInstanceCount = 0;
        clientInstances.length = 0; // Clear the array
    }
}

// --- Test Helper --- 

// Replace the original MCPClient with our mock
const originalMCPClient = MCPClient;
(globalThis as any).MCPClient = MockMCPClient;

function createTestConfigs(count: number): (MCPServerConfig & { api_key?: string | null })[] {
    const configs: (MCPServerConfig & { api_key?: string | null })[] = [];
    for (let i = 0; i < count; i++) {
        configs.push({
            id: i + 1,
            config_id: 100 + i + 1,
            name: `Server ${i + 1}`,
            endpoint_url: `ws://server${i + 1}.local`,
            vault_api_key_id: null,
            timeout_ms: 50,
            max_retries: 1,
            retry_backoff_ms: 10,
            priority: i, // Default priority increases with index
            is_active: true,
            capabilities: null,
            api_key: null,
        });
    }
    return configs;
}

function findMockClient(id: number): MockMCPClient | undefined {
    return clientInstances.find(c => c.id === id);
}

// Restore original client after tests
function cleanup() {
    (globalThis as any).MCPClient = originalMCPClient;
    MockMCPClient.resetAll();
}

// --- Test Suite ---

Deno.test({ name: "MCPManager - constructor filters inactive and sorts by priority", fn: () => {
    MockMCPClient.resetAll();
    const configs = [
        createTestConfigs(1)[0], // Server 1, priority 0, active: true
        { ...createTestConfigs(1)[0], id: 3, config_id: 103, name: "Server 3", priority: -1, is_active: true },
        { ...createTestConfigs(1)[0], id: 4, config_id: 104, name: "Server 4", priority: 5, is_active: false }, // Inactive
        { ...createTestConfigs(1)[0], id: 2, config_id: 102, name: "Server 2", priority: 1, is_active: true },
    ];
    
    const manager = new MCPManager(configs);
    
    // Access private configs for testing (use with caution or refactor manager if needed)
    const internalConfigs = (manager as any).configs as MCPServerConfig[];
    
    assertEquals(internalConfigs.length, 3, "Should only include active configs");
    assertEquals(internalConfigs[0].id, 3, "Should be sorted by priority - Server 3 first");
    assertEquals(internalConfigs[1].id, 1, "Should be sorted by priority - Server 1 second");
    assertEquals(internalConfigs[2].id, 2, "Should be sorted by priority - Server 2 third");
    cleanup();
}});

Deno.test({ name: "MCPManager - processContext success with multiple servers", async fn() {
    MockMCPClient.resetAll();
    const configs = createTestConfigs(2); // Server 1 (prio 0), Server 2 (prio 1)
    configs[0].capabilities = { resources: { supportedTypes: ['userInput'] } }; // Server 1 supports only userInput
    configs[1].capabilities = { resources: true }; // Server 2 supports all (default mock)

    const manager = new MCPManager(configs);

    const mockClient1 = findMockClient(1);
    const mockClient2 = findMockClient(2);
    assertExists(mockClient1);
    assertExists(mockClient2);
    mockClient1.setCapabilities(configs[0].capabilities); // Set mock capabilities
    mockClient2.setCapabilities(configs[1].capabilities);

    // Setup responses
    const response1: { resources: ServerResourceUpdate[] } = { resources: [{ type: 'server1Data', id: 's1', content: 'S1 Processed' }] };
    const response2: { resources: ServerResourceUpdate[] } = { resources: [{ type: 'server2Data', id: 's2', content: 'S2 Processed' }] };
    mockClient1.setSendContextResponse(response1);
    mockClient2.setSendContextResponse(response2);

    const context: GofrAgentsContextData[] = [
        { type: 'userInput', content: 'Hello', timestamp: 't1' },
        { type: 'agentContext', id: 'a1', name: 'Agent', personality: 'Test' },
    ];

    const results = await manager.processContext(context);

    // Assertions
    assertEquals(results.errors.length, 0, "Should have no errors");
    assertEquals(results.resources.length, 2, "Should aggregate resources from both servers");
    assert(results.resources.some(r => r.id === 's1'), "Should contain resource from server 1");
    assert(results.resources.some(r => r.id === 's2'), "Should contain resource from server 2");

    // Check calls
    assertEquals(mockClient1.connectAttempts, 1);
    assertEquals(mockClient1.sendContextAttempts, 1, "Client 1 should send context");
    assertEquals(mockClient1.sendContextArgs[0].length, 1, "Client 1 should only receive userInput context");
    assertEquals(mockClient1.sendContextArgs[0][0].type, 'userInput');

    assertEquals(mockClient2.connectAttempts, 1);
    assertEquals(mockClient2.sendContextAttempts, 1, "Client 2 should send context");
    assertEquals(mockClient2.sendContextArgs[0].length, 2, "Client 2 should receive all context");

    assertEquals(mockClient1.disconnectAttempts, 0); // Manager doesn't disconnect after processContext
    assertEquals(mockClient2.disconnectAttempts, 0);
    cleanup();
}});

Deno.test({ name: "MCPManager - processContext handles server connect error", async fn() {
    MockMCPClient.resetAll();
    const configs = createTestConfigs(2); // Server 1 (prio 0), Server 2 (prio 1)
    const manager = new MCPManager(configs);

    const mockClient1 = findMockClient(1)!;
    const mockClient2 = findMockClient(2)!;
    
    // Server 1 fails to connect
    const connectError = new MCPConnectionError("Server 1 unavailable");
    mockClient1.setConnectShouldError(connectError);
    
    // Server 2 works
    const response2 = { resources: [{ type: 'server2Data', id: 's2', content: 'S2 Only' }] };
    mockClient2.setSendContextResponse(response2);

    const context: GofrAgentsContextData[] = [{ type: 'userInput', content: 'Test', timestamp: 't' }];
    const results = await manager.processContext(context);

    // Assertions
    assertEquals(results.errors.length, 1, "Should have one error from server 1");
    assertEquals(results.errors[0].serverId, 1);
    assertEquals(results.errors[0].error, connectError);
    assertEquals(results.resources.length, 1, "Should only have resources from server 2");
    assertEquals(results.resources[0].id, 's2');

    // Check calls
    assertEquals(mockClient1.connectAttempts, 1);
    assertEquals(mockClient1.sendContextAttempts, 0, "Client 1 should not send context if connect fails");
    assertEquals(mockClient2.connectAttempts, 1);
    assertEquals(mockClient2.sendContextAttempts, 1, "Client 2 should still process");
    cleanup();
}});

Deno.test({ name: "MCPManager - processContext handles server sendContext error", async fn() {
    MockMCPClient.resetAll();
    const configs = createTestConfigs(2);
    const manager = new MCPManager(configs);

    const mockClient1 = findMockClient(1)!;
    const mockClient2 = findMockClient(2)!;

    // Server 1 fails during sendContext
    const sendError = new MCPRequestError("Server 1 processing error");
    mockClient1.setSendContextShouldError(sendError);

    // Server 2 works
    const response2 = { resources: [{ type: 'server2Data', id: 's2', content: 'S2 Only' }] };
    mockClient2.setSendContextResponse(response2);

    const context: GofrAgentsContextData[] = [{ type: 'userInput', content: 'Test', timestamp: 't' }];
    const results = await manager.processContext(context);

    // Assertions
    assertEquals(results.errors.length, 1, "Should have one error from server 1");
    assertEquals(results.errors[0].serverId, 1);
    assertEquals(results.errors[0].error, sendError);
    assertEquals(results.resources.length, 1, "Should only have resources from server 2");
    assertEquals(results.resources[0].id, 's2');

    // Check calls
    assertEquals(mockClient1.connectAttempts, 1);
    assertEquals(mockClient1.sendContextAttempts, 1, "Client 1 should attempt sendContext");
    assertEquals(mockClient2.connectAttempts, 1);
    assertEquals(mockClient2.sendContextAttempts, 1, "Client 2 should still process");
    cleanup();
}});

Deno.test({ name: "MCPManager - processContext skips send if no relevant context", async fn() {
    MockMCPClient.resetAll();
    const configs = createTestConfigs(1);
    // Server only supports 'agentContext'
    configs[0].capabilities = { resources: { supportedTypes: ['agentContext'] } }; 
    const manager = new MCPManager(configs);

    const mockClient1 = findMockClient(1)!;
    mockClient1.setCapabilities(configs[0].capabilities);
    mockClient1.setSendContextResponse({ resources: [] });

    // Context only contains userInput
    const context: GofrAgentsContextData[] = [{ type: 'userInput', content: 'Test', timestamp: 't' }];
    const results = await manager.processContext(context);

    // Assertions
    assertEquals(results.errors.length, 0);
    assertEquals(results.resources.length, 0);
    assertEquals(mockClient1.connectAttempts, 1);
    assertEquals(mockClient1.sendContextAttempts, 0, "Client 1 should not attempt sendContext");
    cleanup();
}});

Deno.test({ name: "MCPManager - disconnectAll calls disconnect on all clients", async fn() {
    MockMCPClient.resetAll();
    const configs = createTestConfigs(3);
    const manager = new MCPManager(configs);

    // Simulate processing to ensure clients are potentially created/connected
    const mockClient1 = findMockClient(1)!;
    const mockClient2 = findMockClient(2)!;
    const mockClient3 = findMockClient(3)!;
    await manager.processContext([]); // Run once to ensure clients exist
    
    assertEquals(mockClient1.disconnectAttempts, 0);
    assertEquals(mockClient2.disconnectAttempts, 0);
    assertEquals(mockClient3.disconnectAttempts, 0);

    manager.disconnectAll();

    assertEquals(mockClient1.disconnectAttempts, 1, "Client 1 disconnect should be called");
    assertEquals(mockClient2.disconnectAttempts, 1, "Client 2 disconnect should be called");
    assertEquals(mockClient3.disconnectAttempts, 1, "Client 3 disconnect should be called");
    cleanup();
}});


// Run cleanup after all tests in the module if needed (might not be necessary depending on runner isolation)
// registerTeardown(cleanup);