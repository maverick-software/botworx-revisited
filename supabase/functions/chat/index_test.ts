// Test file for supabase/functions/chat/index.ts helpers

import {
    assert,
    assertEquals,
    assertExists
} from "https://deno.land/std@0.217.0/assert/mod.ts";
import { MockMCPServer } from "../_shared/mock_mcp_server.ts";

// Mock necessary types/interfaces from the original file if they aren't exported 
// or redefine them simply for the test context.
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

interface AgentopiaContextData {
  type: string;
  // Add other fields as needed for assertion
  [key: string]: any;
}

// Manually define or import the function to be tested
// Option 1: Define inline (if simple and not exported)
async function prepareMCPContext(
  messages: ChatMessage[],
  agentId: string,
  agentName: string,
  agentPersonality: string,
  systemInstructions?: string,
  assistantInstructions?: string
): Promise<AgentopiaContextData[]> {
  const contextData: AgentopiaContextData[] = [];

  // Add agent context
  contextData.push({
    type: 'agentContext',
    id: agentId,
    name: agentName,
    personality: agentPersonality,
    systemInstructions,
    assistantInstructions
  });

  // Add conversation history
  if (messages.length > 0) {
    contextData.push({
      type: 'conversationHistory',
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || new Date().toISOString() // Mock Date if needed
      }))
    });
  }

  // Add latest user input (last user message)
  const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
  if (lastUserMessage) {
    contextData.push({
      type: 'userInput',
      content: lastUserMessage.content,
      timestamp: lastUserMessage.timestamp || new Date().toISOString() // Mock Date if needed
    });
  }

  return contextData;
}

// Option 2: If prepareMCPContext was exported from index.ts (adjust path):
// import { prepareMCPContext } from './index.ts'; 


// --- Test Suite ---

Deno.test("prepareMCPContext - includes agent context", async () => {
    const messages: ChatMessage[] = [];
    const agentId = "agent-123";
    const agentName = "Test Agent";
    const agentPersonality = "Helpful";
    const systemInstructions = "Be concise";

    const result = await prepareMCPContext(
        messages, 
        agentId, 
        agentName, 
        agentPersonality, 
        systemInstructions
    );

    assertEquals(result.length, 1, "Should only contain agentContext with no messages");
    const agentCtx = result.find(ctx => ctx.type === 'agentContext');
    assertExists(agentCtx);
    assertEquals(agentCtx.id, agentId);
    assertEquals(agentCtx.name, agentName);
    assertEquals(agentCtx.personality, agentPersonality);
    assertEquals(agentCtx.systemInstructions, systemInstructions);
    assertEquals(agentCtx.assistantInstructions, undefined);
});

Deno.test("prepareMCPContext - includes history and last user input", async () => {
    const messages: ChatMessage[] = [
        { role: 'user', content: 'First message', timestamp: 't1' },
        { role: 'assistant', content: 'First response', timestamp: 't2' },
        { role: 'user', content: 'Second message', timestamp: 't3' }
    ];
    const agentId = "agent-456";
    const agentName = "Another Agent";
    const agentPersonality = "Curious";

    const result = await prepareMCPContext(messages, agentId, agentName, agentPersonality);

    assertEquals(result.length, 3, "Should contain agentContext, conversationHistory, and userInput");

    const agentCtx = result.find(ctx => ctx.type === 'agentContext');
    assertExists(agentCtx);
    assertEquals(agentCtx.id, agentId);

    const historyCtx = result.find(ctx => ctx.type === 'conversationHistory');
    assertExists(historyCtx);
    assertEquals(historyCtx.messages.length, 3);
    assertEquals(historyCtx.messages[0].content, 'First message');
    assertEquals(historyCtx.messages[2].content, 'Second message');

    const inputCtx = result.find(ctx => ctx.type === 'userInput');
    assertExists(inputCtx);
    assertEquals(inputCtx.content, 'Second message'); // Should be the last user message
    assertEquals(inputCtx.timestamp, 't3');
});

Deno.test("prepareMCPContext - handles empty messages array", async () => {
    const messages: ChatMessage[] = [];
    const agentId = "agent-789";
    const agentName = "Empty Agent";
    const agentPersonality = "Quiet";

    const result = await prepareMCPContext(messages, agentId, agentName, agentPersonality);

    assertEquals(result.length, 1, "Should only contain agentContext");
    assert(result.every(ctx => ctx.type === 'agentContext'));
});

Deno.test("prepareMCPContext - handles messages with only assistant", async () => {
    const messages: ChatMessage[] = [
        { role: 'assistant', content: 'I initiate', timestamp: 't0' }
    ];
    const agentId = "agent-101";
    const agentName = "Proactive Agent";
    const agentPersonality = "Eager";

    const result = await prepareMCPContext(messages, agentId, agentName, agentPersonality);

    assertEquals(result.length, 2, "Should contain agentContext and conversationHistory");
    const historyCtx = result.find(ctx => ctx.type === 'conversationHistory');
    assertExists(historyCtx);
    assertEquals(historyCtx.messages.length, 1);

    const inputCtx = result.find(ctx => ctx.type === 'userInput');
    assertEquals(inputCtx, undefined, "Should not contain userInput if no user message exists");
});

// --- Mock Supabase Client --- 
// Very basic mock - replace with more sophisticated if needed
let mockDbData: Record<string, any[]> = {};
let mockRpcResponses: Record<string, any> = {};

const mockSupabaseClient = {
    from: (tableName: string) => ({
        select: (query: string) => ({
            eq: (column: string, value: any) => ({
                 // Add more chainable methods if needed (like .order, .single)
                 single: async () => {
                     const results = mockDbData[tableName]?.filter(row => row[column] === value);
                     const data = results?.length === 1 ? results[0] : null;
                     const error = data ? null : { message: "No single row found" };
                     console.log(`[Mock DB ${tableName}] single eq ${column}=${value} ->`, { data, error });
                     await delay(1); 
                     return { data, error };
                 },
                 order: (orderCol: string, opts: any) => ({
                     // Basic mock, just returns filtered data, ignoring order
                     then: async (callback: (result: { data: any[] | null, error: any }) => void) => {
                         const results = mockDbData[tableName]?.filter(row => row[column] === value);
                         const data = results || null;
                         const error = null; // Simple mock
                         console.log(`[Mock DB ${tableName}] filter eq ${column}=${value} ->`, { data, error });
                         await delay(1);
                         callback({ data, error });
                     }
                 }), 
                // Allow direct resolution for simple eq filters
                 then: async (callback: (result: { data: any[] | null, error: any }) => void) => {
                     const results = mockDbData[tableName]?.filter(row => row[column] === value);
                     const data = results || null;
                     const error = null; // Simple mock
                     console.log(`[Mock DB ${tableName}] filter eq ${column}=${value} ->`, { data, error });
                     await delay(1);
                     callback({ data, error });
                 }
            })
        }),
        insert: (insertData: any) => ({
             then: async (callback: (result: { data: any[] | null, error: any }) => void) => {
                 if (!mockDbData[tableName]) mockDbData[tableName] = [];
                 const newData = { ...insertData, id: Math.random(), created_at: new Date().toISOString() }; // Assign random ID
                 mockDbData[tableName].push(newData);
                 console.log(`[Mock DB ${tableName}] insert ->`, { data: [newData], error: null });
                 await delay(1);
                 callback({ data: [newData], error: null });
             }
        })
    }),
    rpc: (rpcName: string, params: any) => ({
        single: async () => {
            const data = mockRpcResponses[rpcName] ? mockRpcResponses[rpcName](params) : null;
            const error = data ? null : { message: `Mock RPC ${rpcName} not found or failed` };
            console.log(`[Mock RPC ${rpcName}] params ${JSON.stringify(params)} ->`, { data, error });
            await delay(1);
            return { data, error };
        }
    })
};

// Helper to reset mocks
function resetMocks() {
    mockDbData = {};
    mockRpcResponses = {};
}

// --- Integration Tests ---

// NOTE: These tests assume the Supabase functions are being served locally 
// via `supabase start` on the default port 54321.
const FUNCTION_URL = "http://localhost:54321/functions/v1/chat"; 
// Use the actual service role key from `supabase status` for local testing
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY_TEST") || "your_local_service_role_key"; 

if (SERVICE_ROLE_KEY === "your_local_service_role_key") {
    console.warn("WARN: Using default placeholder service role key for integration tests. Set SUPABASE_SERVICE_ROLE_KEY_TEST env var.");
}

Deno.test({ 
    name: "Integration - Chat function with successful MCP processing", 
    // Use ignore flag if local supabase isn't running or configured
    // ignore: !Deno.env.get("RUN_INTEGRATION_TESTS"), 
    async fn() {
        resetMocks();
        const mockServer = new MockMCPServer({ port: 8081 });
        const serverRunPromise = mockServer.start();
        await delay(100); // Give server time to start listening

        const agentId = "agent-mcp-1";
        const vaultId = "vault-uuid-1";
        const apiKey = "mcp-secret-key";
        const mcpServerId = 99;
        const mcpConfigId = 999;

        // Mock database state
        mockDbData['mcp_configurations'] = [
            {
                id: mcpConfigId,
                agent_id: agentId,
                is_active: true,
                priority: 0,
                server_id: mcpServerId,
                name: "Mock MCP", 
                // Other config fields...
            },
        ];
         mockDbData['mcp_servers'] = [
             {
                 id: mcpServerId,
                 endpoint_url: "ws://localhost:8081",
                 vault_api_key_id: vaultId,
             }
         ];
        mockDbData['agent_interactions'] = []; // Start empty

        // Mock Vault RPC response
        mockRpcResponses['get_secret'] = (params: any) => {
            if (params.secret_id === vaultId) {
                return { key: apiKey };
            }
            return null;
        };

        // Mock OpenAI response (minimum needed)
        // TODO: Replace with actual OpenAI mocking if needed
        const mockOpenAICall = async () => ({ 
             body: new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('Test response'));
                    controller.close();
                }
             })
        });
        // How to mock OpenAI depends heavily on how it's used in index.ts
        // This might require more complex mocking/patching of the openai client

        try {
            const response = await fetch(FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
                },
                body: JSON.stringify({
                    agentId: agentId,
                    messages: [{ role: 'user', content: 'Trigger MCP' }],
                    // Include other required fields like agentName etc.
                    agentName: "TestAgent",
                    agentPersonality: "TestPersonality"
                })
            });

            const responseBody = await response.text();
            console.log("Chat function response status:", response.status);
            console.log("Chat function response body:", responseBody);
            
            assertEquals(response.ok, true, "Chat function should return OK status");
            assertEquals(responseBody, 'Test response', "Should receive mock LLM response");

            // Assertions on Mock MCP Server
            assert(mockServer.receivedRequests.some(r => r.method === 'initialize'), "Mock server should receive initialize");
            const initReq = mockServer.receivedRequests.find(r => r.method === 'initialize')!;
            assertEquals(initReq.params?.authentication?.apiKey, apiKey, "Initialize should contain API key");
            assert(mockServer.receivedRequests.some(r => r.method === 'mcp/provideResources'), "Mock server should receive provideResources");

            // Assertions on Database Log
            await delay(50); // Allow async DB insert to complete
            assertEquals(mockDbData['agent_interactions'].length, 1, "Should log one interaction");
            const logEntry = mockDbData['agent_interactions'][0];
            assertExists(logEntry.mcp_context, "Interaction log should contain MCP context");
            assert(logEntry.mcp_context.includes("mockResource"), "MCP context should include data from mock server");
            assertEquals(logEntry.error, null, "Interaction log should show no MCP error");

        } finally {
            mockServer.stop();
            await serverRunPromise;
        }
    }
});

// TODO: Add more integration tests:
// - Test case where MCP server connect fails
// - Test case where vault key retrieval fails
// - Test case where MCP server returns error
// - Test case with multiple MCP servers

// Placeholder for utility function tests
Deno.test({ 
    name: "Integration - Util function /test success", 
    // ignore: !Deno.env.get("RUN_INTEGRATION_TESTS"), 
    async fn() {
         resetMocks();
        const mockServer = new MockMCPServer({ port: 8082 }); // Use different port
        const serverRunPromise = mockServer.start();
        await delay(100);
        
        const UTIL_FUNCTION_URL = "http://localhost:54321/functions/v1/mcp-server-utils/test";

        try {
             const response = await fetch(UTIL_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
                },
                body: JSON.stringify({
                    serverConfig: {
                         endpoint_url: "ws://localhost:8082",
                         name: "Test Util"
                         // No API key or vault ID sent
                    }
                })
            });
            const result = await response.json();
            console.log("Util /test response:", result);
            
            assertEquals(response.ok, true);
            assertEquals(result.success, true, "Util function should report success");
            assertExists(result.capabilities, "Util function should return capabilities");
            assert(mockServer.receivedRequests.some(r => r.method === 'initialize'), "Mock server should receive initialize from util function");
            assertEquals(mockServer.receivedRequests.find(r=>r.method==='initialize')?.params?.authentication, undefined, "Util function test should not send auth");

        } finally {
            mockServer.stop();
            await serverRunPromise;
        }
    }
}); 