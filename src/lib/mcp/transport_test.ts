// Test file for src/lib/mcp/transport.ts

import { 
    assert, 
    assertEquals, 
    assertRejects,
    assertExists
} from "https://deno.land/std@0.217.0/assert/mod.ts"; // Use appropriate Deno std version
import { MCPTransport, JsonRpcRequest, JsonRpcResponse } from './transport.ts';
import { MCPRequestError } from './errors.ts';
import { delay } from "https://deno.land/std@0.217.0/async/delay.ts";

// --- Mock WebSocket --- 

type MessageEventHandler = (event: { data: any }) => void;
type ErrorEventHandler = (event: Event | ErrorEvent) => void;
type OpenEventHandler = () => void;
type CloseEventHandler = (event: { code: number; reason: string }) => void;

class MockWebSocket {
    static instances: MockWebSocket[] = [];
    static lastUrl: string | null = null;

    readyState: number;
    url: string;
    onmessage: MessageEventHandler | null = null;
    onerror: ErrorEventHandler | null = null;
    onopen: OpenEventHandler | null = null;
    onclose: CloseEventHandler | null = null;

    sentMessages: string[] = [];

    constructor(url: string) {
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        MockWebSocket.instances.push(this);
        MockWebSocket.lastUrl = url;
        // Simulate async connection
        setTimeout(() => this._open(), 10);
    }

    _open() {
        if (this.readyState === MockWebSocket.CONNECTING) {
            this.readyState = MockWebSocket.OPEN;
            this.onopen?.();
        }
    }

    // Method to simulate server sending a message
    simulateServerMessage(data: JsonRpcResponse | object) {
        if (this.readyState === MockWebSocket.OPEN) {
            this.onmessage?.({ data: JSON.stringify(data) });
        }
    }

    // Method to simulate a WebSocket error
    simulateError(errorEvent = new ErrorEvent("error")) {
        if (this.readyState !== MockWebSocket.CLOSED) {
             this.readyState = MockWebSocket.CLOSED; // Typically closes on error
             this.onerror?.(errorEvent);
             // Simulate the close event that often follows an error
             setTimeout(() => this.simulateClose(1006, "Abnormal Closure"), 5);
        }
    }
    
    // Method to simulate connection closing
    simulateClose(code = 1000, reason = "Normal Closure") {
        if (this.readyState !== MockWebSocket.CLOSED) {
            this.readyState = MockWebSocket.CLOSED;
            this.onclose?.({ code, reason });
        }
    }

    send(data: string) {
        if (this.readyState !== MockWebSocket.OPEN) {
            throw new Error("WebSocket is not open");
        }
        this.sentMessages.push(data);
    }

    close(code?: number, reason?: string) {
        this.simulateClose(code ?? 1000, reason ?? "Client closed");
    }

    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    // Helper to get the last created mock instance
    static get lastInstance(): MockWebSocket | null {
        return this.instances.length > 0 ? this.instances[this.instances.length - 1] : null;
    }

    // Reset static state for tests
    static reset() {
        this.instances = [];
        this.lastUrl = null;
    }
}

// Replace global WebSocket with mock before tests
const originalWebSocket = globalThis.WebSocket;
globalThis.WebSocket = MockWebSocket as any;

// --- Test Suite Helper --- 

async function setupTransport(url = "ws://test.local"): Promise<{ transport: MCPTransport; mockWs: MockWebSocket }> {
    MockWebSocket.reset();
    const transport = new MCPTransport(url);
    await transport.connect(); // Wait for the initial async connection attempt
    await delay(20); // Ensure mock WS has time to transition to OPEN
    const mockWs = MockWebSocket.lastInstance;
    assertExists(mockWs, "MockWebSocket instance should exist");
    assertEquals(mockWs.readyState, MockWebSocket.OPEN, "MockWebSocket should be open");
    return { transport, mockWs };
}

// --- Test Suite ---

Deno.test("MCPTransport - connect establishes connection", async () => {
    MockWebSocket.reset();
    const transport = new MCPTransport("ws://connect.test");
    assertEquals(MockWebSocket.instances.length, 0);

    const connectPromise = transport.connect();
    await delay(5); // Allow constructor time
    assertEquals(MockWebSocket.instances.length, 1, "WebSocket should be created");
    const mockWs = MockWebSocket.lastInstance!;
    assertEquals(mockWs.url, "ws://connect.test");
    assertEquals(mockWs.readyState, MockWebSocket.CONNECTING, "Should be connecting initially");

    await connectPromise; // Wait for connect to resolve
    await delay(20); // Ensure internal onopen handler runs

    assertEquals(mockWs.readyState, MockWebSocket.OPEN, "Should be open after connect resolves");
    assert(transport.isConnected(), "Transport should report connected");
});

Deno.test("MCPTransport - connect handles connection error", async () => {
    MockWebSocket.reset();
    const transport = new MCPTransport("ws://error.test");
    const connectPromise = transport.connect();
    await delay(5); 
    const mockWs = MockWebSocket.lastInstance!;
    
    // Simulate error during connection
    mockWs.simulateError(new ErrorEvent('error', { message: 'Connection failed' }));

    await assertRejects(
        async () => await connectPromise,
        Error,
        "WebSocket connection error", // Error message from transport's onerror
        "connect() should reject on WebSocket error"
    );
    assertEquals(mockWs.readyState, MockWebSocket.CLOSED, "WebSocket should be closed after error");
    assert(!transport.isConnected(), "Transport should report not connected after error");
});

Deno.test("MCPTransport - sendRequest sends correctly formatted JSON-RPC", async () => {
    const { transport, mockWs } = await setupTransport();
    const method = "test/method";
    const params = { arg1: "value1", arg2: 123 };

    transport.sendRequest(method, params);
    await delay(1); // Allow promise microtask to run

    assertEquals(mockWs.sentMessages.length, 1, "Should have sent one message");
    const sentData = JSON.parse(mockWs.sentMessages[0]) as JsonRpcRequest;

    assertEquals(sentData.jsonrpc, "2.0");
    assertEquals(sentData.method, method);
    assertEquals(sentData.params, params);
    assertEquals(typeof sentData.id, "number", "ID should be a number");
});

Deno.test("MCPTransport - sendRequest handles successful response", async () => {
    const { transport, mockWs } = await setupTransport();
    const method = "test/success";
    const expectedResult = { success: true, data: "abc" };

    const requestPromise = transport.sendRequest(method, {});
    await delay(1);
    const sentData = JSON.parse(mockWs.sentMessages[0]) as JsonRpcRequest;
    const requestId = sentData.id;

    // Simulate server response
    mockWs.simulateServerMessage({ jsonrpc: "2.0", id: requestId, result: expectedResult });

    const actualResult = await requestPromise;
    assertEquals(actualResult, expectedResult, "Should resolve with the result from the server");
});

Deno.test("MCPTransport - sendRequest handles error response", async () => {
    const { transport, mockWs } = await setupTransport();
    const method = "test/failure";
    const errorCode = -32000;
    const errorMessage = "Server error occurred";
    const errorData = { detail: "something broke" };

    const requestPromise = transport.sendRequest(method, {});
    await delay(1);
    const sentData = JSON.parse(mockWs.sentMessages[0]) as JsonRpcRequest;
    const requestId = sentData.id;

    // Simulate server error response
    mockWs.simulateServerMessage({ 
        jsonrpc: "2.0", 
        id: requestId, 
        error: { code: errorCode, message: errorMessage, data: errorData } 
    });

    await assertRejects(
        async () => await requestPromise,
        MCPRequestError, // Specific error type
        `MCP Error ${errorCode}: ${errorMessage}`, // Expected message
        "sendRequest should reject with MCPRequestError on error response"
    );
    
    try {
        await requestPromise;
    } catch (e) {
        assertEquals((e as MCPRequestError).rpcErrorCode, errorCode);
        assertEquals((e as MCPRequestError).rpcErrorData, errorData);
    }
});

Deno.test("MCPTransport - sendRequest rejects if connection fails before send", async () => {
     MockWebSocket.reset();
     const transport = new MCPTransport("ws://fail.connect");
     const connectPromise = transport.connect();
     await delay(5);
     const mockWs = MockWebSocket.lastInstance!;
     mockWs.simulateError(); // Fail connection
     await connectPromise.catch(() => {}); // Consume connection error
     
     await assertRejects(
         () => transport.sendRequest("test/method"),
         Error,
         "connection failed or closed", // Error message when send attempted on bad connection
         "sendRequest should reject if connection is not open"
     );
});

Deno.test("MCPTransport - disconnect closes WebSocket and rejects pending", async () => {
    const { transport, mockWs } = await setupTransport();
    const requestPromise = transport.sendRequest("test/pending");
    await delay(1);
    assertEquals(mockWs.readyState, MockWebSocket.OPEN);

    transport.disconnect();
    await delay(5);

    // WebSocket close method should have been called (readyState changes)
    assertEquals(mockWs.readyState, MockWebSocket.CLOSED, "Mock WS should be closed after disconnect");
    assert(!transport.isConnected(), "Transport should report not connected after disconnect");

    // Pending request should be rejected
    await assertRejects(
        async () => await requestPromise,
        Error,
        "Transport disconnected by client",
        "Pending request should reject on disconnect"
    );
});

Deno.test("MCPTransport - handles server-initiated close", async () => {
    const { transport, mockWs } = await setupTransport();
    const requestPromise = transport.sendRequest("test/pendingClose");
    await delay(1);

    // Simulate server closing the connection
    mockWs.simulateClose(1001, "Going away");
    await delay(5);

    assertEquals(mockWs.readyState, MockWebSocket.CLOSED, "Mock WS should be closed");
    assert(!transport.isConnected(), "Transport should report not connected");

    // Pending request should be rejected due to close
    await assertRejects(
        async () => await requestPromise,
        Error,
        "WebSocket connection closed (Code: 1001)",
        "Pending request should reject on server close"
    );
});

// Restore original WebSocket after tests if running in a shared context (might not be needed for Deno test runner)
// globalThis.WebSocket = originalWebSocket;