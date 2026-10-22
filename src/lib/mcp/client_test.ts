// Test file for src/lib/mcp/client.ts

import {
    assert,
    assertEquals,
    assertRejects,
    assertExists,
    fail,
} from "https://deno.land/std@0.217.0/assert/mod.ts";
import { delay } from "https://deno.land/std@0.217.0/async/delay.ts";
import { MCPClient } from './client.ts';
import { MCPTransport } from './transport.ts';
import { MCPServerConfig, MCPServerCapabilities, GofrAgentsContextData } from './types.ts';
import { MCPConnectionError, MCPHandshakeError, MCPTimeoutError, MCPRequestError } from './errors.ts';

// --- Mock MCPTransport --- 

let transportInstanceCount = 0;
let lastTransportInstance: MockMCPTransport | null = null;

class MockMCPTransport {
    url: string;
    _isConnected: boolean = false;
    connectAttempts: number = 0;
    disconnectAttempts: number = 0;
    sentRequests: { method: string; params: any }[] = [];
    _connectShouldError: Error | null = null;
    _sendRequestShouldError: Error | null = null;
    _sendRequestResponses: Map<string, any> = new Map(); // Map method to response
    _connectDelayMs: number = 5;
    _sendRequestDelayMs: number = 5;

    constructor(url: string) {
        this.url = url;
        transportInstanceCount++;
        lastTransportInstance = this;
    }

    async connect(): Promise<void> {
        this.connectAttempts++;
        await delay(this._connectDelayMs);
        if (this._connectShouldError) {
            this._isConnected = false;
            throw this._connectShouldError;
        }
        this._isConnected = true;
    }

    disconnect(): void {
        this.disconnectAttempts++;
        this._isConnected = false;
        // In a real scenario, reject pending requests - simplified here
    }

    async sendRequest(method: string, params?: any): Promise<any> {
        if (!this._isConnected) {
            throw new Error("MockTransport: Not connected");
        }
        this.sentRequests.push({ method, params });
        await delay(this._sendRequestDelayMs);
        if (this._sendRequestShouldError) {
            throw this._sendRequestShouldError;
        }
        if (this._sendRequestResponses.has(method)) {
            const response = this._sendRequestResponses.get(method);
            if (response instanceof Error) {
                throw response; // Simulate an error response being converted to rejection
            }
            return structuredClone(response); // Return clone to avoid test interference
        }
        // Default response for unknown methods in mock
        console.warn(`MockMCPTransport: No mock response set for method '${method}', returning default.`);
        if (method === 'initialize') return { capabilities: { resources: true } }; // Default success for initialize
        return { success: true, method: method };
    }

    isConnected(): boolean {
        return this._isConnected;
    }

    // --- Mock configuration methods ---
    setConnectShouldError(error: Error | null) {
        this._connectShouldError = error;
    }
    setSendRequestShouldError(error: Error | null) {
        this._sendRequestShouldError = error;
    }
    setSendRequestResponse(method: string, response: any) {
        this._sendRequestResponses.set(method, response);
    }
    setConnectDelay(ms: number) {
        this._connectDelayMs = ms;
    }
    setSendRequestDelay(ms: number) {
        this._sendRequestDelayMs = ms;
    }
    resetMockState() {
        this.connectAttempts = 0;
        this.disconnectAttempts = 0;
        this.sentRequests = [];
        this._isConnected = false;
        this._connectShouldError = null;
        this._sendRequestShouldError = null;
        this._sendRequestResponses.clear();
        this._connectDelayMs = 5;
        this._sendRequestDelayMs = 5;
    }

     // --- Static Mock Reset --- 
    static resetAll() {
        transportInstanceCount = 0;
        lastTransportInstance = null;
    }
}

// --- Test Helper --- 

function createTestConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig & { api_key?: string | null } {
    return {
        id: 1,
        config_id: 101,
        name: "TestServer",
        endpoint_url: "ws://test.local",
        vault_api_key_id: null,
        timeout_ms: 50,
        max_retries: 2, // Default: 2 retries (3 attempts total)
        retry_backoff_ms: 10,
        priority: 0,
        is_active: true,
        capabilities: null,
        api_key: null,
        ...overrides,
    };
}

async function setupClient(configOverrides: Partial<MCPServerConfig> = {}): Promise<{ client: MCPClient; mockTransport: MockMCPTransport; config: MCPServerConfig & { api_key?: string | null } }> {
    MockMCPTransport.resetAll();
    const config = createTestConfig(configOverrides);
    
    // Replace the transport constructor JUST for this client instance
    const originalTransport = MCPTransport;
    (MCPClient as any).prototype.transport = new MockMCPTransport(config.endpoint_url);
    const client = new MCPClient(config);
    // Restore original transport prototype for other tests if needed, though mocking global might be simpler
    // (MCPClient as any).prototype.transport = originalTransport.prototype; 
    
    const mockTransport = lastTransportInstance;
    assertExists(mockTransport, "MockTransport instance should have been created");
    mockTransport.resetMockState(); // Ensure clean state for test
    return { client, mockTransport, config };
}

// --- Test Suite ---

Deno.test("MCPClient - connect success on first attempt", async () => {
    const { client, mockTransport, config } = await setupClient();
    const expectedCaps: MCPServerCapabilities = { resources: true, prompts: false };
    mockTransport.setSendRequestResponse('initialize', { capabilities: expectedCaps });

    const capabilities = await client.connect();

    assertEquals(mockTransport.connectAttempts, 1, "Should attempt connection once");
    assertEquals(mockTransport.sentRequests.length, 1, "Should send initialize request once");
    assertEquals(mockTransport.sentRequests[0].method, 'initialize');
    assertEquals(capabilities, expectedCaps, "Should return capabilities from server");
    assertEquals(client.getServerCapabilities(), expectedCaps, "getServerCapabilities should return stored caps");
    assert(client.isConnected(), "Client should report connected");
    assertEquals(mockTransport.disconnectAttempts, 0, "Should not disconnect on success");
});

Deno.test("MCPClient - connect success with API key", async () => {
    const testApiKey = "test-key-123";
    const { client, mockTransport, config } = await setupClient({ api_key: testApiKey });
    mockTransport.setSendRequestResponse('initialize', { capabilities: { resources: true } });

    await client.connect();

    assertEquals(mockTransport.sentRequests.length, 1);
    assertEquals(mockTransport.sentRequests[0].method, 'initialize');
    assertEquals(mockTransport.sentRequests[0].params?.authentication, { apiKey: testApiKey }, "API key should be sent in initialize params");
});

Deno.test("MCPClient - connect retries on connection error", async () => {
    const { client, mockTransport, config } = await setupClient({ max_retries: 1 }); // 2 attempts total
    const expectedCaps: MCPServerCapabilities = { tools: true };

    // Fail first connect attempt, succeed second
    mockTransport.setConnectShouldError(new Error("Initial connect fail"));
    mockTransport.setSendRequestResponse('initialize', { capabilities: expectedCaps });

    const connectPromise = client.connect();

    // After first attempt fails
    await delay(config.retry_backoff_ms + 20); // Wait for backoff + connect delay
    assertEquals(mockTransport.connectAttempts, 2, "Should attempt connection twice");
    mockTransport.setConnectShouldError(null); // Allow second attempt to succeed

    const capabilities = await connectPromise;
    assertEquals(capabilities, expectedCaps, "Should return capabilities after retry success");
    assertEquals(mockTransport.sentRequests.length, 1, "Should only send initialize once connection succeeds");
    assert(client.isConnected(), "Client should be connected after retry");
});

Deno.test("MCPClient - connect fails after max retries (connection error)", async () => {
    const { client, mockTransport, config } = await setupClient({ max_retries: 1 }); // 2 attempts total

    // Fail all connect attempts
    mockTransport.setConnectShouldError(new Error("Connect always fails"));

    await assertRejects(
        () => client.connect(),
        MCPConnectionError, // Should throw specific connection error
        "Failed to connect after 2 attempts", // Message should indicate max attempts
        "Connect should fail after max retries"
    );
    assertEquals(mockTransport.connectAttempts, 2, "Should attempt connection max times");
    assertEquals(mockTransport.disconnectAttempts, 2, "Should disconnect after each failed attempt");
    assert(!client.isConnected(), "Client should not be connected");
});

Deno.test("MCPClient - connect retries on handshake error", async () => {
    const { client, mockTransport, config } = await setupClient({ max_retries: 1 }); // 2 attempts total
    const handshakeError = new MCPHandshakeError("Invalid handshake response");
    const expectedCaps: MCPServerCapabilities = { prompts: true };

    // Fail first handshake attempt, succeed second
    mockTransport.setSendRequestResponse('initialize', handshakeError); // Fail first initialize
    
    const connectPromise = client.connect();

    // After first attempt fails and retries
    await delay(config.retry_backoff_ms + 20); // Wait for backoff + connect delay
    mockTransport.setSendRequestResponse('initialize', { capabilities: expectedCaps }); // Succeed second initialize

    const capabilities = await connectPromise;

    assertEquals(mockTransport.connectAttempts, 2, "Should attempt connection twice");
    assertEquals(mockTransport.sentRequests.length, 2, "Should send initialize twice");
    assertEquals(capabilities, expectedCaps, "Should return capabilities after successful retry");
    assert(client.isConnected(), "Client should be connected");
});

Deno.test("MCPClient - connect fails after max retries (handshake error)", async () => {
    const { client, mockTransport, config } = await setupClient({ max_retries: 1 }); // 2 attempts total
    const handshakeError = new MCPHandshakeError("Always invalid handshake");

    // Fail all handshake attempts
    mockTransport.setSendRequestResponse('initialize', handshakeError);

    await assertRejects(
        () => client.connect(),
        MCPHandshakeError, // Should throw the specific handshake error
        "Always invalid handshake", 
        "Connect should fail after max retries on handshake"
    );
    assertEquals(mockTransport.connectAttempts, 2, "Should attempt connection max times");
    assertEquals(mockTransport.sentRequests.length, 2, "Should send initialize max times");
    assertEquals(mockTransport.disconnectAttempts, 2, "Should disconnect after each failed attempt");
    assert(!client.isConnected(), "Client should not be connected");
});

Deno.test("MCPClient - connect fails on timeout", async () => {
    const { client, mockTransport, config } = await setupClient({ timeout_ms: 20 }); // Short timeout
    
    // Make connection take longer than timeout
    mockTransport.setConnectDelay(config.timeout_ms * 3); // connect() part takes longer

    await assertRejects(
        () => client.connect(),
        MCPTimeoutError, 
        `Operation timed out after ${config.timeout_ms * 2}ms`, // Uses 2x timeout for combined connect+handshake
        "Connect should fail with timeout error"
    );
    assertEquals(mockTransport.connectAttempts, 1, "Should attempt connection once before timeout");
    assertEquals(mockTransport.disconnectAttempts, 1, "Should disconnect after timeout"); // Disconnect called in catch
});

Deno.test("MCPClient - sendContext success", async () => {
    const { client, mockTransport, config } = await setupClient();
    // Ensure connected first
    mockTransport.setSendRequestResponse('initialize', { capabilities: { resources: true } });
    await client.connect();
    mockTransport.resetMockState(); // Reset after connect

    const context: GofrAgentsContextData[] = [{ type: 'userInput', content: 'Hello', timestamp: new Date().toISOString() }];
    const expectedResponse = { status: "received" };
    mockTransport.setSendRequestResponse('mcp/provideResources', expectedResponse);

    const response = await client.sendContext(context);

    assertEquals(response, expectedResponse);
    assertEquals(mockTransport.sentRequests.length, 1);
    assertEquals(mockTransport.sentRequests[0].method, 'mcp/provideResources');
    assertEquals(mockTransport.sentRequests[0].params, { resources: context });
});

Deno.test("MCPClient - sendContext fails if server doesn\'t support resources", async () => {
    const { client, mockTransport, config } = await setupClient();
    // Server has no resource capability
    mockTransport.setSendRequestResponse('initialize', { capabilities: { prompts: true } }); 
    await client.connect();
    mockTransport.resetMockState();

    const context: GofrAgentsContextData[] = [{ type: 'userInput', content: 'Hello', timestamp: new Date().toISOString() }];
    
    // sendContext should not throw, but return null (or similar)
    const response = await client.sendContext(context);

    assertEquals(response, null, "Should return null if no resource capability");
    assertEquals(mockTransport.sentRequests.length, 0, "Should not send request if no capability");
});

Deno.test("MCPClient - sendContext retries on send error", async () => {
    const { client, mockTransport, config } = await setupClient();
    mockTransport.setSendRequestResponse('initialize', { capabilities: { resources: true } });
    await client.connect();
    mockTransport.resetMockState();

    const context: GofrAgentsContextData[] = [{ type: 'userInput', content: 'Hi', timestamp: 't1' }];
    const expectedResponse = { status: "ok finally" };
    const sendError = new MCPRequestError("Temporary send glitch");

    // Fail first send, succeed second
    mockTransport.setSendRequestShouldError(sendError);
    const sendPromise = client.sendContext(context);
    
    await delay(config.timeout_ms + 20); // Wait for first attempt + timeout
    assertEquals(mockTransport.sentRequests.length, 1, "First send attempt should happen");
    mockTransport.setSendRequestShouldError(null); // Clear error for retry
    mockTransport.setSendRequestResponse('mcp/provideResources', expectedResponse); // Set success response for retry

    const response = await sendPromise;

    assertEquals(mockTransport.sentRequests.length, 2, "Should attempt send twice");
    assertEquals(response, expectedResponse, "Should return success response after retry");
});

Deno.test("MCPClient - sendContext fails after max retries (send error)", async () => {
    const { client, mockTransport, config } = await setupClient();
    mockTransport.setSendRequestResponse('initialize', { capabilities: { resources: true } });
    await client.connect();
    mockTransport.resetMockState();

    const context: GofrAgentsContextData[] = [{ type: 'userInput', content: 'Again', timestamp: 't2' }];
    const sendError = new MCPRequestError("Persistent send failure");
    mockTransport.setSendRequestShouldError(sendError);

    await assertRejects(
        () => client.sendContext(context),
        MCPRequestError, // Should throw the specific request error
        "Failed to send context after 2 attempts",
        "sendContext should fail after max send retries"
    );
    assertEquals(mockTransport.sentRequests.length, 2, "Should attempt send max times (default 2)");
});

Deno.test("MCPClient - disconnect calls transport disconnect", async () => {
    const { client, mockTransport } = await setupClient();
    mockTransport.setSendRequestResponse('initialize', { capabilities: { resources: true } });
    await client.connect();
    assertEquals(mockTransport.disconnectAttempts, 0);

    client.disconnect();
    
    assertEquals(mockTransport.disconnectAttempts, 1, "Transport disconnect should be called");
    assert(!client.isConnected(), "Client should report not connected");
    assertEquals(client.getServerCapabilities(), null, "Capabilities should be cleared on disconnect");
});

Deno.test("MCPClient - testConnection success", async () => {
    const { client, mockTransport, config } = await setupClient();
    const expectedCaps = { resources: true };
    mockTransport.setSendRequestResponse('initialize', { capabilities: expectedCaps });

    const result = await client.testConnection();

    assert(result.success, "testConnection should report success");
    assertEquals(result.capabilities, expectedCaps, "testConnection should return capabilities");
    assertEquals(mockTransport.connectAttempts, 1, "testConnection should attempt connect once");
    assertEquals(mockTransport.sentRequests.length, 1, "testConnection should send initialize");
    assertEquals(mockTransport.disconnectAttempts, 1, "testConnection should disconnect after success");
    assert(!client.isConnected(), "Client should be disconnected after testConnection");
});

Deno.test("MCPClient - testConnection failure", async () => {
    const { client, mockTransport, config } = await setupClient();
    const connectError = new MCPConnectionError("Test connect failed");
    mockTransport.setConnectShouldError(connectError);

    const result = await client.testConnection();

    assert(!result.success, "testConnection should report failure");
    assert(result.message.includes("Test connect failed"), "testConnection failure message should include error");
    assertEquals(result.capabilities, undefined, "testConnection should not return capabilities on failure");
    assertEquals(mockTransport.connectAttempts, 1, "testConnection should attempt connect once even on failure");
    assertEquals(mockTransport.sentRequests.length, 0, "testConnection should not send initialize if connect fails");
    assertEquals(mockTransport.disconnectAttempts, 1, "testConnection should disconnect even after failure");
    assert(!client.isConnected(), "Client should be disconnected after failed testConnection");
});