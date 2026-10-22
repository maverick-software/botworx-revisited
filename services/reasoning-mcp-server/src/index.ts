import express, { Request, Response, NextFunction } from 'express';

// Define interfaces for our MCP request parameters for clarity
interface ReasoningTaskParams {
  taskId: string;
  reasoningSessionId?: string | null;
  reasoningType: string; // e.g., "inductive", "deductive", "planAndExecuteCoT"
  goalQuery: string;
  contextData?: { // Optional context data
    historicalConversation?: string | null;
    domainKnowledge?: string | null;
    availableTools?: object | null;
    currentPlanStep?: string | null;
    hostProvidedPriorReasoningSummary?: string | object | null;
  } | null;
  outputRequirements?: { // Optional output requirements
    format?: string; // e.g., "finalAnswerWithTrace", "detailedPlanWithPrompts"
    maxSteps?: number | null;
    desiredConfidenceLevel?: number | null;
  } | null;
  preferredCoTVariation?: string | null;
  sessionState?: object | null; // Opaque state from server's last response
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any; // Can be more specific if all methods have known param structures
  id: string | number | null;
}

const app = express();
const port = process.env.REASONING_MCP_PORT || 3001;

app.use(express.json());

// Middleware for basic logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (Object.keys(req.body).length > 0) {
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

const mcpCapabilities = {
  "mcp": { "version": "1.0" },
  "reasoning": {
    "version": "0.1.0",
    "serverName": "AgentopiaAdvancedReasoningServerV1",
    "supportedReasoningTypes": [
      "inductive",
      "deductive",
      "abductive",
      "planAndExecuteCoT"
    ],
    "supportedCoTVariations": [
      "standardCoT",
      "selfConsistency",
      "selfAsk",
      "treeOfThoughts_basic"
    ],
    "supportedPlanExecutionFeatures": {
      "maxPlanDepth": 5,
      "allowsToolIntegrationViaHost": true
    },
    "confidenceScoring": {
      "supportedMethods": ["verbalizedConfidence", "pTrue"],
      "defaultMethod": "verbalizedConfidence",
      "returnsScore": true
    },
    "outputFormatsSupported": [
        "finalAnswerWithTrace", 
        "detailedPlanWithPrompts"
    ],
    "documentationUrl": "https://example.com/docs/reasoning-server-v0.1"
  }
};

// Placeholder for the internal orchestrator function
async function internalOrchestrator(params: ReasoningTaskParams) {
  console.log(`[Internal Orchestrator] Received task: ${params.taskId}, type: ${params.reasoningType}`);
  console.log(`[Internal Orchestrator] Goal: ${params.goalQuery}`);

  let reasoningModuleSelected = "Unknown";
  let taskOutcomeDetails: any = {}; // Using any for now as modules will have different structures
  let needsToolCall = false;
  let toolCallRequestDetails: object | null = null;

  // --- POC Deductive Reasoning Handler ---
  async function handleDeductiveReasoningPoc(currentTaskParams: ReasoningTaskParams): Promise<object> {
    console.log(`[Deductive POC] Handling task: ${currentTaskParams.taskId}`);
    const goal = currentTaskParams.goalQuery;
    // const context = currentTaskParams.contextData; // Would be used in real implementation

    // 1. Simulate Premise Identification
    const premises = "Simulated Premises: All men are mortal. Socrates is a man."; // Hardcoded for POC
    console.log(`[Deductive POC] Identified premises: ${premises}`);

    // 2. Simulate CoT Prompt Generation
    const cotPrompt = `Goal: ${goal}\nPremises: ${premises}\nLet\'s think step by step to reach the conclusion:`;
    console.log(`[Deductive POC] Generated CoT Prompt:\n${cotPrompt}`);

    // 3. Simulate LLM Call & Response
    console.log("[Deductive POC] Simulating LLM call...");
    // In a real scenario, this would be an async call to an LLM service
    const simulatedLlmResponse = `Okay, let\'s think step by step for the goal \'${goal}\'.\nGiven Premises: ${premises}\nStep 1: The premise \'All men are mortal\' establishes a general rule about the category \'men\'.\nStep 2: The premise \'Socrates is a man\' places \'Socrates\' within the category \'men\'.\nStep 3: Applying the general rule from Step 1 to the specific instance in Step 2, if all entities in the category \'men\' are mortal, and \'Socrates\' is an entity in the category \'men\', then \'Socrates\' must possess the attribute \'mortal\'.\nConclusion: Therefore, Socrates is mortal.`;
    console.log(`[Deductive POC] Simulated LLM Response:\n${simulatedLlmResponse}`);

    // 4. Simulate Result Interpretation
    console.log("[Deductive POC] Interpreting simulated LLM response...");
    // For POC, we can just extract the conclusion or use parts of the trace.
    // A more robust parser would be needed for actual LLM output.
    const conclusion = simulatedLlmResponse.substring(simulatedLlmResponse.lastIndexOf("Conclusion: Therefore, ") + "Conclusion: Therefore, ".length).replace('.','');
    
    return {
      reasonedAnswer: conclusion || "Socrates is mortal (extracted from POC simulation)",
      reasoningTrace: `Deductive CoT Steps (Simulated):\nPrompt: ${cotPrompt}\nLLM Response (Simulated):\n${simulatedLlmResponse}`,
      confidenceScore: 0.98, // High confidence for this direct simulated deduction
      // plan: null, // Not typically set by deductive
      // promptsToExecute: null // Not typically set by deductive
    };
  }
  // --- End POC Deductive Reasoning Handler ---

  switch (params.reasoningType) {
    case "inductive":
      reasoningModuleSelected = "Inductive Reasoning Module";
      console.log(`[Internal Orchestrator] Selecting: ${reasoningModuleSelected}`);
      // TODO (WBS 2.1.4+): Implement inductive reasoning flow
      // 1. Generate specific prompts for inductive reasoning based on params.goalQuery and params.contextData.
      // 2. Make LLM call(s).
      // 3. Interpret LLM results to form a generalized rule/hypothesis.
      // 4. Populate taskOutcomeDetails with the reasonedAnswer, trace, confidence, etc.
      taskOutcomeDetails = { reasonedAnswer: "Inductive POC not yet implemented." };
      break;
    case "deductive":
      reasoningModuleSelected = "Deductive Reasoning Module";
      console.log(`[Internal Orchestrator] Selecting: ${reasoningModuleSelected}`);
      taskOutcomeDetails = await handleDeductiveReasoningPoc(params);
      break;
    case "abductive":
      reasoningModuleSelected = "Abductive Reasoning Module";
      console.log(`[Internal Orchestrator] Selecting: ${reasoningModuleSelected}`);
      // TODO (WBS 2.1.4+): Implement abductive reasoning flow
      // 1. Identify observations from params.goalQuery and params.contextData.
      // 2. Generate prompts to form multiple hypotheses.
      // 3. Generate prompts to evaluate hypotheses (explanatory power, simplicity).
      // 4. Make LLM call(s).
      // 5. Select the best explanation and populate taskOutcomeDetails.
      taskOutcomeDetails = { reasonedAnswer: "Abductive POC not yet implemented." };
      break;
    case "planAndExecuteCoT":
      reasoningModuleSelected = "Plan and Execute CoT Module";
      console.log(`[Internal Orchestrator] Selecting: ${reasoningModuleSelected}`);
      // TODO (WBS 2.1.4+): Implement Plan and Execute CoT flow
      // 1. Generate initial plan based on params.goalQuery.
      // 2. For each step in the plan:
      //    a. Generate CoT prompts for the step.
      //    b. Make LLM call(s).
      //    c. Interpret results, update plan state, potentially interact with tools (via Agentopia).
      // 3. Consolidate results and populate taskOutcomeDetails.
      taskOutcomeDetails = { reasonedAnswer: "PlanAndExecuteCoT POC not yet implemented." };
      break;
    default:
      console.log(`[Internal Orchestrator] Unknown reasoning type: ${params.reasoningType}. Defaulting to general handler.`);
      reasoningModuleSelected = `General Handler for ${params.reasoningType}`;
      // TODO: Implement a more robust default behavior or error for unknown types
      break;
  }

  if (needsToolCall) {
    return {
      taskId: params.taskId,
      reasoningSessionId: params.reasoningSessionId || params.taskId,
      status: "pending_tool_call",
      taskOutcome: null, // Or partial results if applicable
      toolCallRequest: toolCallRequestDetails,
      userInputRequest: null,
      error: null,
      updatedSessionState: { placeholder: "orchestrator_state_pending_tool_result" }
    };
  }

  return {
    taskId: params.taskId,
    reasoningSessionId: params.reasoningSessionId || params.taskId,
    status: "completed",
    taskOutcome: {
      reasonedAnswer: taskOutcomeDetails.reasonedAnswer || `Orchestrator selected ${reasoningModuleSelected}. Goal: ${params.goalQuery}. (Details pending actual module implementation)`,
      reasoningTrace: taskOutcomeDetails.reasoningTrace || `Trace for ${reasoningModuleSelected} on task ${params.taskId}. (Details pending actual module implementation)`,
      confidenceScore: taskOutcomeDetails.confidenceScore || 0.90,
      plan: taskOutcomeDetails.plan || null,
      promptsToExecute: taskOutcomeDetails.promptsToExecute || null,
      // Any other details from taskOutcomeDetails would be here too if not explicitly destructured above
    },
    toolCallRequest: null,
    userInputRequest: null,
    error: null,
    updatedSessionState: { placeholder: "orchestrator_updated_session_state_after_flow_management_placeholder" }
  };
}

app.post('/mcp', async (req: Request, res: Response) => {
  const { jsonrpc, method, params, id } = req.body as JsonRpcRequest;

  if (jsonrpc !== '2.0' || !id) {
    return res.status(400).json({ jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid Request' } });
  }

  if (method === 'initialize') {
    console.log(`Handling 'initialize' request with ID: ${id}`);
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        serverName: "AgentopiaAdvancedReasoningServerV1",
        capabilities: mcpCapabilities
      }
    });
  } else if (method === 'reasoning/executeTask') {
    console.log(`Handling 'reasoning/executeTask' request with ID: ${id}`);
    const taskParams = params as ReasoningTaskParams;

    if (!taskParams || !taskParams.taskId || !taskParams.goalQuery || !taskParams.reasoningType) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: 'Invalid params for reasoning/executeTask', details: 'Missing taskId, goalQuery, or reasoningType' }
      });
    }

    try {
      const orchestratorResult = await internalOrchestrator(taskParams);
      return res.json({ jsonrpc: '2.0', id, result: orchestratorResult });
    } catch (e: any) {
      console.error('[Internal Orchestrator] Error:', e);
      return res.status(500).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: 'Internal server error during reasoning task', details: e.message }
      });
    }

  } else {
    console.log(`Method '${method}' not found. Request ID: ${id}`);
    return res.status(404).json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  }
});

app.listen(port, () => {
  console.log(`Reasoning Toolbox Support Server listening on port ${port}`);
  console.log(`MCP endpoint available at http://localhost:${port}/mcp`);
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
  if (!res.headersSent) {
    res.status(500).json({ jsonrpc: '2.0', id: (req.body as JsonRpcRequest)?.id || null, error: { code: -32000, message: 'Internal server error' } });
  }
}); 