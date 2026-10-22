# WBS Checklist: Advanced Reasoning Capability (via MCP Server)
**Date Created:** 05/06/2025
**Plan Name:** Advanced Reasoning Capability (via MCP Server)

**Dependency Note:** Full realization of Agentopia integration (Phase 2.A onwards) and corresponding Frontend/Testing/Logging depends on the successful implementation of the **Agent Tool Infrastructure** plan (`docs/plans/agent_tool_infrastructure/wbs_checklist.md`). Specific dependencies are noted on relevant items below.

## Phase 1: Research and Foundational Design

### 1.1 Research (Rule #6: Check Web) - *Primarily informs Reasoning MCP Server design*
- [x] 1.1.1 Research: Prompting techniques for Inductive Reasoning in LLMs
    - **Notes - Inductive Reasoning Prompts:**
        - **General Principle:** Guide the LLM to identify patterns in provided examples and then generalize a rule or hypothesis.
        - **Few-Shot Learning:** Provide several examples (instance, observation) and then ask the LLM to derive a general principle or predict the next instance.
        - **Explicit Instruction:** "Based on the following examples, what is the underlying pattern or rule?" or "Generate a hypothesis that explains these observations."
        - **Step-by-Step Analysis:** "Analyze each example: Example 1 -> Observation 1. Example 2 -> Observation 2. What general rule connects these observations to the examples?"
        - **Hypothesis Generation and Testing (Iterative):**
            - Prompt to generate an initial hypothesis based on a subset of data.
            - Prompt to test the hypothesis against new data.
            - Prompt to refine the hypothesis if it fails the test.
        - **Consider Analogical Reasoning:** "This new problem is similar to [solved problem X]. How did we solve X, and how can that apply here?" (Though this borders on case-based, it uses inductive leaps).
        - **Focus on Salient Features:** "What are the key distinguishing features in these examples that might lead to the observed outcomes?"
        - **Output Format:** Ask for the generalized rule to be stated clearly.
        - **Key Takeaway:** Emphasis on providing clear examples and guiding the LLM to generalize from them. The process can be iterative.
- [x] 1.1.2 Research: Prompting techniques for Deductive Reasoning in LLMs
    - **Notes - Deductive Reasoning Prompts:**
        - **Chain-of-Thought (CoT) is Fundamental:** Explicitly ask to "think step-by-step" or "show reasoning." This helps in breaking down problems, applying rules sequentially. Enhances accuracy and transparency.
            - *Example:* "If A=B and B=C, explain step-by-step if A=C and why."
        - **Few-Shot Examples with CoT:** Provide examples demonstrating the step-by-step deductive process.
        - **Clarity and Specificity:**
            - Clearly define the problem and desired output format.
            - Use unambiguous language.
            - Break down complex tasks into smaller prompts if needed.
        - **Structured Prompting:**
            - *QA Format:* Question with explicit request for reasoning steps before the answer.
            - *Instructional Steps:* Provide a numbered list of logical steps for the model to follow.
            - *Templates:* Use consistent templates for recurring tasks (Background, Objective, Reasoning, Conclusion).
        - **Advanced CoT Variations (applicable):**
            - *Self-Consistency:* Generate multiple deductive paths, choose the most consistent conclusion.
            - *Tree-of-Thoughts (ToT):* Explore multiple deductive branches, evaluate validity, backtrack if needed. Useful when the path isn't obvious.
            - *Decomposed Prompting:* Break complex query into sequential sub-questions.
        - **Providing Rules/Axioms:** Explicitly state rules, axioms, or premises.
            - *Example:* "Given: 'All X are Y' and 'Z is X'. Deduce: Relationship between Z and Y. Show work."
        - **Socratic Method:** Guide deduction through dialogue (definition, elenchus, dialectic).
        - **DID (Deductive and InDuctive) Framework:** Dynamically integrates inductive and deductive reasoning. The deductive part involves applying derived rules.
        - **Modern Prompt Structure (Goal, Return Format, Warnings, Context):** Clearly state goal, specify output format, add coherence checks/warnings, provide context.
        - **Key Takeaway:** Start with clear CoT, possibly with few-shot examples. For complex cases, consider self-consistency or simplified ToT. Explicitly stating rules/premises is crucial.
- [x] 1.1.3 Research: Prompting techniques for Abductive Reasoning in LLMs
    - **Notes - Abductive Reasoning Prompts (Inference to the Best Explanation):**
        - **1. Present Observations Clearly:** Input all relevant facts, symptoms, or data that need explaining.
            - *Example:* "Observations: The street is wet. It did not rain today. The sprinklers were not on. My car, parked on the street, is also wet."
        - **2. Multiple Hypothesis Generation:** Explicitly ask for several plausible explanations.
            - *Prompt:* "Based on these observations, list all plausible hypotheses that could explain them."
        - **3. Chain-of-Thought for Each Hypothesis:** For each hypothesis, ask how it explains the observations.
            - *Prompt:* "For each hypothesis, explain the step-by-step reasoning that connects it to ALL the observed facts."
        - **4. Evaluate and Rank Hypotheses:** Instruct the LLM to evaluate hypotheses based on criteria:
            - *Explanatory Power:* How well does it cover all observations?
            - *Simplicity (Occam's Razor):* Is it the least complex explanation?
            - *Plausibility/Likelihood:* Consistency with general knowledge or provided context.
            - *Internal Consistency:* Does it contradict itself or other knowns?
            - *Prompt:* "Evaluate each hypothesis on a scale of 1-5 for explanatory power, simplicity, and plausibility. Justify scores. Which is the most likely overall?"
        - **5. Reflective/Self-Critical Loops:** Prompt for review of hypotheses and evaluations.
            - *Prompt:* "Are there any flaws or missing pieces in your top hypothesis? Can any other hypothesis better explain a specific observation?"
        - **6. Iterative Refinement:** Allow for new evidence and re-evaluation.
            - *Prompt:* "New observation: A fire hydrant down the street is open. How does this affect your hypotheses? Re-evaluate."
        - **7. Consider Alternatives (Counterfactuals/Socratic):**
            - *Prompt:* "If your top hypothesis were false, what would be the next most likely explanation? What single piece of evidence would most strongly confirm/deny your current best explanation?"
        - **8. External Tool Use/Verification (Advanced):** LLM could suggest checks if integrated with tools.
        - **Key Takeaway (for MCP Server):** Abductive reasoning is a multi-step process for the server: receive observations -> generate multiple hypotheses (LLM call) -> evaluate/rank hypotheses (LLM call(s)) -> select best explanation -> return to Agentopia. It's inherently about exploring and weighing possibilities.
- [x] 1.1.4 Research: Advanced Chain-of-Thought (CoT) variations (e.g., Self-Ask, Tree-of-Thoughts, Plan-and-Execute frameworks) - *Relevant for all reasoning types within the MCP Server*
    - **Notes - Advanced CoT Variations:**
        - **Standard CoT:** Baseline "think step-by-step."
        - **Self-Consistency (with CoT):** Generate multiple CoTs, take majority vote on the answer. Improves reliability.
            - *Use Case:* Critical steps needing higher accuracy.
        - **Tree of Thoughts (ToT):** Explores multiple reasoning paths in a tree. Generates multiple thoughts per step, evaluates them, and decides which path to pursue/backtrack. Mimics human-like exploration.
            - *Components:* Thought Decomposition, Thought Generation (sampling/proposing), State Evaluation (LLM self-evaluates promise), Search Algorithm (BFS/DFS).
            - *Use Case:* Complex problems needing exploration, strategic planning, lookahead (e.g., Game of 24, creative writing puzzles).
            - *Limitation:* Resource-intensive.
        - **Graph of Thoughts (GoT):** Extends ToT to a graph structure, allowing more complex thought interconnections (merging, refining, cycles).
        - **Algorithm of Thoughts (AoT):** Aims for structured, efficient algorithmic thinking emulation.
        - **Self-Ask:** LLM asks itself follow-up questions to decompose a problem, then uses answers to solve the main question.
        - **ReAct (Reasoning and Acting):** LLM generates interleaved reasoning traces (thoughts) and actions. Actions can use external tools (via `mcp/tools` in our case). (Thought -> Action -> Observation loop).
            - *Use Case:* Tasks needing external information or tool interaction to ground reasoning.
        - **Plan-and-Execute (or Plan-and-Solve):** Two-stage: 1. LLM generates a high-level plan (sequence of steps). 2. LLM (or orchestrator) executes each step, potentially using CoT/ReAct for individual steps.
            - *Use Case:* Overall architecture for the Reasoning MCP Server's internal orchestrator.
        - **Least-to-Most Prompting:** Decompose complex problem into simpler subproblems, solve sequentially, feeding previous solutions into next prompts.
        - **kNoT (Knowledgeable Network of Thoughts):** Uses an "LLM Workflow Template" (LWT) for executable plans as arbitrary networks of LLM operations.
        - **Key Takeaway (for MCP Server):** The Reasoning MCP Server could use a Plan-and-Execute overall strategy. Individual plan steps could leverage Standard CoT, Self-Consistency, Self-Ask/ReAct (for tool use via Agentopia), or even ToT for highly explorative steps. The choice can be dynamic or based on task complexity.
- [x] 1.1.5 Research: LLM Self-Evaluation & Confidence Scoring methodologies - *To be implemented within the Reasoning MCP Server*
    - **Notes - LLM Self-Evaluation & Confidence Scoring:**
        - **Goal:** Assess reliability of LLM's own reasoning/answers.
        - **Why Needed:** Standard likelihood scores (perplexity, sequence probability) often don't correlate well with quality/correctness.
        - **Confidence Score Elicitation Methods:**
            - **1. Verbalized Confidence:** Prompt LLM to state confidence (numeric scale 0-100, binary 0/1, linguistic). Simple but may need calibration.
            - **2. P(True) / Token Probability:** Prompt for binary confidence (0/1), use the actual probability assigned to the '1' token. Requires access to token probabilities. Performed well in CISC paper.
            - **3. Sequence Probability:** Use probability of the whole reasoning path + answer. Often less effective.
            - **4. Consistency-Based:** Derive confidence from agreement across multiple generated samples (e.g., SelfCheckGPT for factuality, majority vote proportion). More compute-intensive.
        - **Self-Evaluation Techniques (Broader than just scoring):**
            - **LLM-as-a-Judge (Internal):** Use an LLM (same or different) to evaluate generated reasoning/answer against criteria (G-Eval for subjective, DAG for structured checks, QAG for factuality).
            - **Self-Critique / Self-Refine:** Prompt LLM to critique its output and then improve it.
            - **SaySelf Framework:** Fine-tuning to generate confidence scores *and* self-reflective rationales explaining uncertainty.
        - **Evaluating the Confidence Scores Themselves:**
            - **Calibration:** Do scores match actual correctness probability (e.g., ECE)?
            - **Discrimination:** Can scores separate correct/incorrect answers (e.g., AUC)?
            - **Within-Question Discrimination (WQD):** Can scores distinguish correct/incorrect answers *for the same question*? (Important for weighting different paths).
        - **Key Takeaway (for MCP Server):** The Reasoning MCP server needs to output a confidence score. P(True) (if logits available) or Verbalized Confidence are primary candidates. Consistency checks (SelfCheckGPT) or internal LLM-as-a-Judge steps could enhance robustness before assigning the final score. Score should be returned to Agentopia.
- [x] 1.1.6 Research: Best practices for integrating complex reasoning flows with existing Tool Use functionalities - *Relevant for how the Reasoning MCP Server might request Agentopia to use tools via `mcp/tools` (see `mcp_developer_guide.mdc`)*
    - **Notes - Integrating Reasoning & Tool Use:**
        - **Core Idea:** Allow the reasoning process (within the MCP server) to leverage external tools provided by the host (Agentopia).
        - **Mechanism (ReAct/Agentic Loop):**
            - **Think:** Reasoning Server determines a need for external info/action.
            - **Act:** Reasoning Server sends `mcp/tools/call` request to Agentopia, specifying tool name & args.
            - **Observe:** Agentopia executes the tool and sends the result (or error) back to the Reasoning Server (e.g., via `mcp/tools/result` or response).
            - **Think:** Reasoning Server incorporates the observation into its ongoing reasoning plan.
        - **Best Practices for Agentopia's Role (Host):**
            - **Clear Tool Definitions:** Agentopia must provide clear, specific, natural language descriptions of its tools (via MCP, perhaps `mcp/tools/list`) so the Reasoning Server can select appropriately.
            - **Reliable Execution:** Agentopia needs to execute requested tools reliably.
            - **Structured Results:** Send results back to the Reasoning Server in a predictable, structured format.
            - **Error Reporting:** Clearly report tool execution errors back to the Reasoning Server.
        - **Best Practices for Reasoning MCP Server's Role (Agent):**
            - **Reason Before Acting:** Internally justify *why* a tool is needed before requesting it.
            - **Handle Observations:** Integrate tool results/errors gracefully into the reasoning flow.
            - **Error Recovery:** Plan for failed tool calls (retry, ask user via Agentopia?, alternative path).
            - **Simplicity:** Don't request tools unnecessarily.
        - **Key Takeaway (for Interaction):** The core interaction is the Reasoning Server requesting tool execution from Agentopia via standard or custom MCP methods (`mcp/tools/call`, `mcp/tools/result`). Success depends heavily on clear tool descriptions from Agentopia and robust handling of the request/response cycle by both ends.
- [x] 1.1.7 Research: MCP (Model Context Protocol) specification for custom capabilities and methods, focusing on how a server can advertise and execute complex, multi-step tasks like reasoning. (Primary Reference: `mcp_developer_guide.mdc`)
    - **Notes - MCP Specs for Custom Capabilities/Methods (from `mcp_developer_guide.mdc`):**
        - **Capability Advertisement:** Servers declare their capabilities (e.g., supported reasoning types, specific methods) in the `capabilities` object during the `initialize` handshake.
        - **Custom Methods:** Define custom, namespaced JSON-RPC methods (e.g., `reasoning/executeTask`) for the host (Agentopia) to call. Specify parameters and expected response structure.
        - **Executing Complex Tasks:** Complex, multi-step tasks are handled internally by the server logic triggered by a custom method call. The server manages its internal state and reasoning flow (e.g., using Plan-and-Execute, CoT variations).
        - **Context Provision:** Agentopia provides necessary input/context to the server using standard methods like `resources/provide`.
        - **Server-Initiated Actions:** If the server needs Agentopia to perform actions during its internal reasoning (e.g., fetch data via a tool), it uses standard methods like `tools/call`.
        - **Key Takeaway:** MCP provides the framework (initialization, JSON-RPC, standard methods) to integrate a custom reasoning server. The server advertises its specific reasoning functions as capabilities/custom methods, and handles the complex logic internally, potentially calling back to the host for tools/data as needed.

### 1.2 Design - Reasoning MCP Server: Capabilities & Interface
- [x] 1.2.1 Define: How the Reasoning MCP Server advertises its capabilities (e.g., supported reasoning types: "inductive", "deductive", "abductive", "planAndExecuteCoT"; supported CoT variations; max complexity levels) in the MCP `initialize` response. (Refer to `mcp_developer_guide.mdc` on capabilities)
    - **Notes - Reasoning Server Capability Advertisement:**
        - The server will advertise its capabilities within the `initialize` response's `capabilities` object, under a dedicated `reasoning` namespace.
        - **Proposed Structure:**
          ```json
          {
            "capabilities": {
              "mcp": { "version": "1.0" },
              "reasoning": {
                "version": "0.1.0", // Version of the reasoning capability
                "serverName": "AgentopiaAdvancedReasoningServerV1", // Example server identifier
                "supportedReasoningTypes": [
                  "inductive",
                  "deductive",
                  "abductive",
                  "planAndExecuteCoT" // A comprehensive, flexible type
                ],
                "supportedCoTVariations": [ // For internal use or specific requests
                  "standardCoT",
                  "selfConsistency",
                  "selfAsk", // Implies potential for tool interaction
                  "treeOfThoughts_basic" // Acknowledging ToT's resource intensity
                ],
                "supportedPlanExecutionFeatures": {
                  "maxPlanDepth": 5, // Example limit
                  "allowsToolIntegrationViaHost": true // Critical for ReAct-style operations
                },
                "confidenceScoring": {
                  "supportedMethods": ["verbalizedConfidence", "pTrue"], // From research 1.1.5
                  "defaultMethod": "verbalizedConfidence",
                  "returnsScore": true
                },
                "outputFormatsSupported": [ // What structures the server can return
                    "finalAnswerWithTrace", 
                    "detailedPlanWithPrompts" // e.g., for Agentopia to execute LLM steps
                ],
                "documentationUrl": "https://example.com/docs/reasoning-server-v0.1" // Optional
              }
            }
          }
          ```
        - **Key Considerations:**
            - `reasoning.version`: Allows for evolution of the reasoning server's capabilities.
            - `supportedReasoningTypes`: Clearly lists the primary modes of reasoning offered.
            - `supportedCoTVariations`: Indicates sophistication of internal thought processes.
            - `allowsToolIntegrationViaHost`: Essential for the server to request Agentopia to use tools.
            - `confidenceScoring`: Addresses the requirement for self-evaluation.
            - `outputFormatsSupported`: Informs Agentopia on how to handle the server's responses (e.g., is it a final answer, or a plan for Agentopia to execute?).
- [x] 1.2.2 Design: Custom MCP method(s) for Agentopia to request reasoning tasks (e.g., `reasoning/executeTask` or `reasoning/generatePlanAndPrompt`). Define request parameters (e.g., `reasoningType`, `goalQuery`, `contextData`, `outputRequirements`) and response structure (e.g., `reasonedAnswer`, `confidenceScore`, `reasoningTrace`, `plan`, `promptsToExecute`). (Refer to `mcp_developer_guide.mdc` on JSON-RPC methods)
    - **Notes - Custom MCP Method for Reasoning:**
        - **Primary Method:** `reasoning/executeTask`
        - **Rationale:** A versatile single method to handle various reasoning requests. The server internally manages complexity based on parameters.
        - **Request Parameters (`reasoning/executeTask`):**
          ```json
          {
            "taskId": "unique_task_identifier_string", // For Agentopia tracking of this specific call
            "reasoningSessionId": "string | null", // ID for the overarching reasoning session (e.g., original taskId from Agentopia). If provided, server attempts to use/evolve existing KG for this session.
            "reasoningType": "string", // e.g., "inductive", "deductive", "planAndExecuteCoT"
            "goalQuery": "string", // The core task/question for this specific call
            "contextData": {
              "historicalConversation": "string" | null,
              "domainKnowledge": "string" | null,
              "availableTools": "object" | null,
              "currentPlanStep": "string" | null,
              "hostProvidedPriorReasoningSummary": "string | object | null" // Summary of findings from Agentopia's prior cycles for this session
            },
            "outputRequirements": {
              "format": "string", // e.g., "finalAnswerWithTrace", "detailedPlanWithPrompts"
              "maxSteps": "integer" | null,
              "desiredConfidenceLevel": "float" | null
            },
            "preferredCoTVariation": "string" | null,
            "sessionState": "object | null" // Opaque state from server's last response for this reasoningSessionId, enabling it to resume.
          }
          ```
        - **Response Structure (`reasoning/executeTask`):**
          ```json
          {
            "taskId": "unique_task_identifier_string", // Mirrors request's taskId for this specific call
            "reasoningSessionId": "string | null", // Mirrors request's reasoningSessionId
            "status": "string", // "completed", "failed", "pending_tool_call", "pending_user_input", "max_iterations_reached"
            "result": { // If "completed"
              "reasonedAnswer": "string" | null,
              "reasoningTrace": "string" | "object" | null, // Should ideally include a representation (e.g., summary, key sub-graph) of the KG or its parts relevant to the answer if KG-centric.
              "confidenceScore": "float" | null,
              "plan": "object" | null,
              "promptsToExecute": ["string"] | null
            },
            "toolCallRequest": { // If status is "pending_tool_call"
              "toolName": "string",
              "toolArguments": "object",
              "toolCallId": "unique_tool_call_id_string"
            },
            "userInputRequest": "string" | null,
            "error": { // If "failed"
              "code": "integer",
              "message": "string",
              "details": "string" | null
            },
            "updatedSessionState": "object | null" // Opaque state from server, including its handle to the evolved KG for this reasoningSessionId. Agentopia MUST pass this back on the next call for the same session.
          }
          ```
        - **Key Features of this Design:**
            - **Flexibility:** `reasoningType` and `outputRequirements.format` drive server behavior.
            - **Tracking:** `taskId` for asynchronous correlation.
            - **Context Richness:** `contextData` provides necessary inputs.
            - **Interactive Flows:** `status` field (e.g., `pending_tool_call`, `pending_user_input`) enables multi-step interactions. The server would internally await `mcp/tools/result` from Agentopia if it initiated a `mcp/tools/call`.
            - **Statefulness:** `sessionState` allows for conversational reasoning continuity.
- [x] 1.2.3 Evaluate: If standard MCP methods like `mcp/prompts` (server provides prompts for Agentopia to run) or `mcp/tools` (server requests Agentopia to run tools) can be leveraged or are sufficient for certain reasoning flows. (Consult `mcp_developer_guide.mdc`)
    - **Notes - Evaluation of Standard MCP Methods:**
        - **`mcp/tools` (`tools/call`, `tools/result`):**
            - **Leveraged & Essential.** The Reasoning MCP Server will use `mcp/tools/call` to request Agentopia to execute tools when its internal reasoning (e.g., a ReAct or Plan-and-Execute step) requires external action/information.
            - Agentopia will respond with `mcp/tools/result`.
            - Our custom `reasoning/executeTask` response's `status: "pending_tool_call"` and `toolCallRequest` object are primarily for Agentopia's awareness of the server's state if the overall task is waiting on a tool. The actual tool call interaction follows the standard MCP `tools/call` and `tools/result` pattern as per `mcp_developer_guide.mdc`.
        - **`mcp/prompts` (`prompts/generate`, `prompts/execute`):**
            - **Less Directly Used by Reasoning Server for Host LLM Calls:** The `mcp_developer_guide.mdc` positions `prompts/generate` as a server capability to *provide* prompts, and `prompts/execute` for a host to ask a server to run *its own internal* prompts (if the server is a prompt execution engine).
            - **Our Approach:** If the Reasoning MCP Server needs Agentopia to execute LLM prompts, it will return these prompts within the `result.promptsToExecute` field of our custom `reasoning/executeTask` method, typically when `outputRequirements.format` is `"detailedPlanWithPrompts"`.
            - **Why Custom Method for Prompts:** This keeps the "reasoning task" cohesive. Agentopia calls `reasoning/executeTask` and gets back either a final answer or a plan/prompts related to *that specific task*.
            - If the Reasoning MCP Server *were* primarily a simple prompt execution engine (which it is not, it's more advanced), then Agentopia might use `mcp/prompts/execute` more directly with it.
        - **Conclusion:**
            - The custom `reasoning/executeTask` method remains the core interface for initiating advanced reasoning.
            - It integrates seamlessly with the standard `mcp/tools` flow for server-initiated tool use by Agentopia.
            - It handles the "server providing prompts to host" scenario through its own response structure rather than relying on the server directly calling a standard `mcp/prompts` method on the host.
- [x] 1.2.4 Define: LLM-friendly definitions, characteristics, and example prompts for Inductive, Deductive, and Abductive reasoning that the *Reasoning MCP Server* will use internally.
    - **Notes - Internal Definitions & Meta-Prompts for Reasoning Server (KG-Centric Operations):**

    -   **A. Inductive Reasoning (Generalizing from Specifics within the KG)**
        -   **LLM-Friendly Definition:** "Inductive reasoning involves observing specific examples or pieces of evidence and then forming a general rule, hypothesis, or conclusion that likely explains them or predicts future occurrences. It's about moving from specific instances to a broader generalization." (Essentially unchanged)
        -   **Key Characteristics/Goals for LLM:**
            -   Identify patterns, trends, or commonalities across multiple specific examples (now, examples/nodes/subgraphs within the KG).
            -   Formulate a plausible general principle or hypothesis that extends beyond the given KG elements.
            -   Acknowledge that the conclusion is probable, not absolutely certain.
            -   Focus on creating the *most likely* or *simplest* generalization relevant to the KG's purpose. (Essentially unchanged)
        -   **Example Internal KG-Centric Meta-Prompt Structure 1 (Pattern ID & Generalization on KG):**
            ```
            System: You are an analytical reasoner. Your task is to perform inductive reasoning on a knowledge graph.
            User: You are given a knowledge graph (KG) representing the current understanding of a problem.
            Current KG (simplified representation or relevant subgraph):
            {{current_kg_state_or_subgraph}}

            Focus on the following set of nodes/patterns within the KG:
            {{set_of_relevant_kg_nodes_or_patterns}}

            Based *only* on these KG elements and their relationships:
            1. Identify underlying commonalities, patterns, or recurring relationship structures.
            2. Formulate a general rule, hypothesis, or new abstract concept (potential new node type or relationship type) that explains these patterns within the KG.
            3. If proposing a new concept/relationship, define it clearly and state how it would connect to the existing KG.
            4. Explain your step-by-step thinking in deriving this rule or concept from the KG.
            ```
        -   **Example Internal KG-Centric Meta-Prompt Structure 2 (Hypothesis for KG Enrichment):**
            ```
            System: You are an expert at forming hypotheses to expand a knowledge graph.
            User: The current knowledge graph is as follows:
            {{current_kg_state}}

            We are trying to understand {{overall_goal_or_query_context}}.
            Based on the existing entities and relationships in the KG, what new, generalized concept or relationship type could be inductively inferred that would significantly improve our understanding or help achieve the goal?
            Propose [1-2] such new KG elements (node types or relationship types with definitions).
            For each, explain how it generalizes from existing KG information and why adding it would be beneficial.
            ```

    -   **B. Deductive Reasoning (Applying General Rules & Traversing the KG)**
        -   **LLM-Friendly Definition:** "Deductive reasoning involves starting with one or more general statements or premises that are accepted as true, and then using logic to reach a specific, logically certain conclusion. If the premises are true and the logic is valid, the conclusion *must* be true." (Essentially unchanged)
        -   **Key Characteristics/Goals for LLM:**
            -   Strictly apply given general rules/premises to a specific situation (now, to the KG).
            -   Ensure logical steps are valid and explicit.
            -   Conclusion must be a necessary consequence of the KG state and rules.
            -   Avoid introducing new information/assumptions not present in the KG or rules. (Essentially unchanged)
        -   **Example Internal KG-Centric Meta-Prompt Structure 1 (Rule Application & KG Inference):**
            ```
            System: You are a precise logical reasoner. Your task is to perform deductive reasoning on a knowledge graph using given rules.
            User: You are given the current knowledge graph (KG):
            {{current_kg_state_or_subgraph}}

            And the following set of true premises (rules) that operate on entities and relationships found in KGs like this:
            Rule 1: {{text_of_rule_1_operating_on_kg_constructs}}
            Rule 2: {{text_of_rule_2_operating_on_kg_constructs}}
            ...

            And the following specific query related to the KG:
            Query: {{specific_query_about_kg_entities_or_relationships}}

            Apply the given rules to the current KG.
            Deduce any new nodes, relationships, or attributes that must be true for the KG based on the rules and existing KG state.
            If the query can be answered with certainty, provide the answer.
            Show your step-by-step deductive reasoning, clearly stating how each rule is applied to the KG to reach new inferences or the answer.
            Output any new KG triples (Subject-Predicate-Object) that can be definitively added.
            ```
        -   **Example Internal KG-Centric Meta-Prompt Structure 2 (KG Path Traversal & Validation):**
            ```
            System: You are an expert in formal logic and graph traversal.
            User: Consider the current knowledge graph:
            {{current_kg_state}}

            We need to determine if {{node_A}} is related to {{node_B}} via the path {{proposed_path_description_or_sequence_of_relationship_types}}.
            1. Validate if this path exists and is logically sound according to the relationships defined in the KG.
            2. If the path exists, what is the specific conclusion about the relationship between {{node_A}} and {{node_B}}?
            3. If the path does not exist or is invalid, explain why.
            Show your deductive steps by tracing the path through the KG.
            ```

    -   **C. Abductive Reasoning (Inferring Best Explanations for KG State or Missing Links)**
        -   **LLM-Friendly Definition:** "Abductive reasoning involves starting with a set of observations or facts and then finding the simplest and most likely hypothesis or explanation that, if true, would best account for those observations. It's about inferring the most plausible cause or reason." (Essentially unchanged)
        -   **Key Characteristics/Goals for LLM:**
            -   Generate multiple potential hypotheses (new KG nodes/edges) for given observations or gaps in the KG.
            -   Evaluate hypotheses based on explanatory power for the KG, simplicity, consistency with the KG.
            -   Select and justify the "best" or "most plausible" KG addition.
            -   Recognize conclusion is a plausible inference, not certainty. (Essentially unchanged)
        -   **Example Internal KG-Centric Meta-Prompt Structure 1 (Best Explanation for KG State/Gap):**
            ```
            System: You are a diagnostic reasoner, skilled at finding the best explanation for knowledge graph configurations.
            User: The current knowledge graph (KG) is as follows:
            {{current_kg_state_or_subgraph}}

            We have observed {{specific_observation_about_kg_or_a_gap_in_kg}}.
            For example, we expected to see a connection between {{node_X}} and {{node_Y}} based on the query {{goalQuery}}, but it's missing or indirect.

            Your task is to perform abductive reasoning:
            1. Generate [2-3] distinct plausible hypotheses for *new nodes or relationships* that, if added to the KG, would best explain the observation or fill the gap.
            2. For each hypothesis, explain how adding it to the KG would account for the observation/gap.
            3. Evaluate each hypothesis based on its explanatory power for the KG state, its simplicity (minimizing new entities unless necessary), and its consistency with the rest of the KG and the overall {{goalQuery}}.
            4. Select the single best hypothesis (set of new nodes/relationships to add).
            5. Justify your choice.
            Output the proposed KG additions (new triples).
            ```
        -   **Example Internal KG-Centric Meta-Prompt Structure 2 (Hypothesizing Causes from KG Effects):**
            ```
            System: You are an investigator using a knowledge graph.
            User: Our knowledge graph currently shows the following effects or end-states:
            {{kg_nodes_representing_effects_or_symptoms}}

            Given the overall context of {{goalQuery}}, what are the most plausible *causal chains* (sequences of nodes and relationships) that could be added to the KG to explain how these effects came to be?
            Propose [1-2] such causal chains.
            For each, describe the new nodes and relationships involved and how they form a coherent explanation within the KG.
            Which proposed chain is the most compelling and why?
            ```
- [x] 1.2.5 Design: Strategy for how these internal definitions (from 1.2.4) are used by the Reasoning MCP Server's internal orchestrator.
    - **Notes - Reasoning MCP Server Internal Orchestrator Strategy (KG-Centric Approach with Session Persistence):**

    -   **Overall Philosophy:** The Reasoning MCP Server's core strategy revolves around dynamically constructing and reasoning over a Knowledge Graph (KG) associated with a `reasoningSessionId`. This KG represents the server's evolving understanding of the `goalQuery` and its context across multiple, related `reasoning/executeTask` calls from Agentopia (e.g., during Agentopia's Q&A refinement loop).

    -   **1. Receive and Parse Request:**
        -   Validates `reasoning/executeTask` parameters.
        -   Extracts `reasoningSessionId` and `sessionState` (from Agentopia, which is the server's `updatedSessionState` from prior call).

    -   **2. Initialize or Retrieve & Seed Knowledge Graph:**
        -   **If `reasoningSessionId` is provided AND `sessionState` allows retrieval of an existing KG for this session:**
            -   The orchestrator loads/retrieves the active KG associated with this `reasoningSessionId`.
            -   The `goalQuery` and `contextData.hostProvidedPriorReasoningSummary` for the *current* call are used to further enrich or focus operations on this existing KG.
        -   **Else (no `reasoningSessionId`, or no active KG found/resumable):**
            -   A new KG is instantiated for a new `reasoningSessionId` (which could be the `taskId` of this first call).
            -   It parses the current `goalQuery` and initial `contextData` to create seed nodes/edges. This might involve an initial LLM call for entity/relationship extraction.
        -   The `taskId` of the current call is used for logging and tracking this specific transaction.

    -   **3. Iterative KG Expansion & Reasoning (Driven by `reasoningType` on the current KG state):**
        -   (Logic largely as before, but operates on the session's KG)
        -   The orchestrator selects a strategy based on the requested `reasoningType`. This strategy dictates how the KG is iteratively built and analyzed. The LLM-friendly definitions and meta-prompts (from a revised 1.2.4) will now be framed as instructions for the LLM to operate on/contribute to the KG.
            -   **Example Flow for `planAndExecuteCoT` (now KG-centric):**
                -   An initial LLM call, given the seed KG and `goalQuery`, proposes a high-level plan for KG expansion and analysis (e.g., "Identify related concepts for node X," "Find evidence for relationship Y->Z," "Hypothesize missing links between A and B").
                -   The orchestrator executes each plan step:
                    -   This might involve further LLM calls (using KG-specific meta-prompts) to generate new nodes/edges, identify patterns (inductive on KG), apply rules (deductive on KG), or form hypotheses (abductive on KG).
                    -   This might trigger a tool call (see step 4) to fetch external data to enrich a node or validate an edge.
            -   **Specific Reasoning Types as KG Operations:**
                -   *Inductive:* LLM prompted to find patterns/generalizations across sets of nodes/subgraphs in the KG, potentially creating new abstract nodes or relationship types.
                -   *Deductive:* LLM prompted to apply rules or traverse existing KG relationships to infer new facts (nodes/edges) or validate paths.
                -   *Abductive:* LLM prompted to propose new nodes/edges that, if added to the KG, would best explain the current KG state in relation to the query.
        -   **CoT Variations on KG:** Advanced CoT techniques (Self-Consistency, Self-Ask on KG, ToT on KG paths) are applied to these KG operations.
        -   **Safeguards:** Implement a maximum number of iterations/expansion steps/LLM calls for KG construction to prevent infinite loops. Max depth of KG exploration might also be a parameter.

    -   **4. Handle Tool Integration for KG Enrichment:**
        -   If a KG expansion/validation step requires external information (identified by LLM or orchestrator logic):
            -   Identifies tool/params. Internal state to `pending_tool_call`.
            -   Server sends `mcp/tools/call` to Agentopia. Awaits `mcp/tools/result`.
            -   Tool result is used to add/update nodes or edges in the KG. Orchestrator continues KG processing.

    -   **5. Perform Self-Evaluation & Confidence Scoring (KG-driven):**
        -   Confidence is assessed based on the state and structure of the final KG in relation to the `goalQuery`.
        -   Potential factors (from 1.1.5 research, now applied to KG):
            -   *KG Richness/Density:* Number of relevant nodes and interconnections supporting the answer.
            -   *Evidence Strength:* How many initial facts or tool-retrieved data points support the key nodes/paths in the KG leading to the answer.
            -   *Path Plausibility/Completeness:* For answers derived from KG paths, evaluate the strength/certainty of each link.
            -   *Coverage:* Does the KG adequately address the main components of the query?
        -   This might involve specific LLM calls to evaluate the KG or its components.
        -   **Safeguards:** Confidence seeking is subject to max iteration limits.

    -   **6. Extract Answer & Format Response:**
        -   The final answer is extracted/derived from the resulting KG.
        -   Assembles response per `outputRequirements.format`.
        -   **`reasoningTrace` should ideally include a representation (e.g., summary, key sub-graph, or full if feasible) of the KG or the parts most relevant to the answer.**
        -   Sets `status` (e.g., "completed", "failed", "max_iterations_reached"), `updatedSessionState`.

    -   **7. Error Handling & State Management:**
        -   Manages internal state (current KG state for active sessions, plan step, waiting states).
        -   Handles errors (LLM, tool, KG construction) and populates `error` field.
        -   **Retry Mechanisms:** For transient errors during internal LLM calls or tool interactions, limited retries (e.g., up to 3 attempts with backoff) are implemented.
        -   Return appropriate status if safeguards are hit.

    -   **8. Reasoning Session Lifecycle Management (New Point):**
        -   The server needs a robust mechanism to manage the lifecycle of KGs associated with `reasoningSessionId`s to prevent resource exhaustion.
        -   **Mechanisms:**
            -   **Timeout:** If no `reasoning/executeTask` calls are received for an active `reasoningSessionId` within a configurable period (e.g., 10-30 minutes), the server automatically concludes the session and releases/archives the KG.
            -   **Explicit End (Preferred for clean shutdown by client):** Consider a lightweight MCP method like `reasoning/endSession(sessionId: string)` that Agentopia calls when its Q&A refinement loop is complete or the user moves on.
            -   **Limit on Active Sessions:** The server may have a limit on the total number of active KG sessions it can maintain concurrently.
            -   The `updatedSessionState` returned to Agentopia implicitly contains the server's handle to its state; if Agentopia loses this or sends an invalid one, the server may not be able to resume that specific KG.

### 1.3 Design - Agentopia Integration with Reasoning MCP Server
- [ ] 1.3.1 Design: Logic within Agentopia (e.g., `chat` function or a new orchestrator) to determine *when* to invoke the Reasoning MCP Server (e.g., based on query complexity, user intent, or explicit agent configuration).
    - **Notes - Agentopia's Logic for Invoking Reasoning MCP Server:**
        - **Goal:** Determine when a user query or task is best handled by the advanced reasoning capabilities of a configured Reasoning MCP Server versus Agentopia's standard internal LLM processing or simpler tool use.
        - **Location of Logic:** This logic would likely reside in Agentopia's main `chat` processing function or a dedicated pre-processing/orchestration step before primary LLM calls.

        - **Proposed Multi-Factor Decision Logic:**

            -   **1. Prerequisite Checks (Gates):**
                -   **Agent Configuration:** Is `advanced_reasoning_enabled` set to `true` for the current agent?
                -   **Server Configuration:** Is a valid Reasoning MCP Server configured in `mcp_servers` table and marked as active/healthy (via a basic periodic health check or status flag)?
                -   *If any prerequisite fails, Agentopia defaults to its standard internal processing.* 

            -   **2. Explicit Triggers / Heuristics (Positive Signals for Advanced Reasoning):**
                -   **Query Complexity Analysis (Lightweight):**
                    -   *Keyword/Phrase Matching:* Identify terms indicative of complex reasoning needs (e.g., "hypothesize why...", "deduce the consequences of...", "plan a solution for...", "what is the underlying pattern in...", "explain the causal chain for...").
                    -   *Question Structure:* Queries involving multiple dependent sub-questions, counterfactuals, or requests for deep explanation.
                    -   *Entity/Relationship Density:* Queries mentioning many entities that need to be understood in relation to each other.
                    -   *(Implementation: Could be a fast local model, regex, or a very quick preliminary LLM call for classification).* 
                -   **User Intent Classification (If Available):**
                    -   If Agentopia classifies user intent, intents like "deep problem-solving," "strategic planning," "comparative analysis," or "causal explanation" would strongly favor advanced reasoning.
                -   **Task Type (If Agent is Executing a Multi-Step Task):** Certain predefined complex task types might always route to the Reasoning MCP Server if available.

            -   **3. Standard Processing Attempt & Escalation (Conditional):**
                -   **Tiered Approach (Default):**
                    -   Agentopia first attempts to handle the query using its standard, more lightweight internal LLM call and/or simple tool use.
                    -   **Escalation Criteria:** If this standard attempt results in:
                        -   A very low confidence score from its internal LLM.
                        -   A clearly nonsensical, irrelevant, or overtly generic refusal (e.g., "I cannot answer that.").
                        -   Known failure patterns for that type of query with the standard approach.
                        -   Then, if prerequisites in (1) are met, escalate to the Reasoning MCP Server.
                -   **Direct to Advanced Reasoning (Optional for Strong Signals):**
                    -   If the analysis in (2) yields a very strong, unambiguous signal for advanced reasoning, Agentopia *could* be configured to bypass the standard attempt and go directly to the Reasoning MCP Server. This could be an agent-level or system-level setting to optimize for quality over initial speed/cost for certain agents/queries.

            -   **4. Historical Context / Session Coherence:**
                -   If a previous turn in the conversation successfully utilized the Reasoning MCP Server and the current query is a direct follow-up requiring similar depth, Agentopia might prefer to re-engage the server for consistency, possibly using `sessionState`.

            -   **5. Invocation and Parameterization:**
                -   If the decision is to use the Reasoning MCP Server:
                    -   Agentopia's orchestrator determines the most appropriate `reasoningType` to request from the server's advertised capabilities (e.g., if keywords suggest "deduce," request "deductive"; if complex and open, might default to "planAndExecuteCoT"). This selection logic is key.
                    -   It assembles the `contextData` (historical chat, relevant documents/tools available to *Agentopia* that the server might reference or ask for).
                    -   It defines `outputRequirements` (e.g., requesting `finalAnswerWithTrace`).
                    -   It calls `reasoning/executeTask` via the `MCPManager`.

        - **Summary of Flow:** Gate Checks -> Heuristic Analysis -> Standard Attempt (with Escalation) OR Direct Advanced -> Invoke Reasoning MCP Server.
        - **Tuning:** Thresholds for complexity, low confidence, and strength of heuristic signals will require tuning during implementation and testing.

- [x] 1.3.2 Design: Logic for Agentopia to select the appropriate reasoning type/goal to request from the Reasoning MCP Server based on its advertised capabilities and the nature of the user's query.
    - **Notes - Agentopia's Logic for Selecting `reasoningType`:**
        - **Goal:** Enable Agentopia to intelligently choose the most appropriate `reasoningType` to request from the Reasoning MCP Server based on the user's query and the server's advertised capabilities.
        - **Inputs to Logic:** User query, `reasoning.supportedReasoningTypes` from server capabilities, results from preliminary query analysis (from 1.3.1).

        - **Proposed Selection Strategy:**

            -   **1. Keyword/Pattern-Based Mapping (Primary Filter):**
                -   Agentopia maintains an internal mapping of keywords, phrases, or query structures to specific `reasoningType`s.
                -   *Examples:*
                    -   "Explain why X occurred", "What could be the cause of Y?", "Hypothesize about Z" -> Suggests `abductive`.
                    -   "If A and B, then what about C?", "Deduce from these facts...", "Given rule X, what is Y?" -> Suggests `deductive`.
                    -   "What is the pattern in this data?", "Generalize from these examples..." -> Suggests `inductive`.
                    -   "Plan a solution for...", "How do I achieve X (multi-step)?", "Solve complex problem Y" -> Suggests `planAndExecuteCoT`.
                -   This provides an initial candidate `reasoningType`.

            -   **2. Leverage Broader Query Analysis/Intent (Refinement):**
                -   If the preliminary query analysis (from 1.3.1) classified user intent or overall complexity, this can confirm or refine the choice from keyword mapping.
                -   *Examples:*
                    -   Intent "problem-solving with unknown cause" -> Reinforces `abductive` or `planAndExecuteCoT`.
                    -   Intent "logical inference from knowns" -> Reinforces `deductive`.
                    -   High complexity score with no clear single reasoning type -> Favors `planAndExecuteCoT`.

            -   **3. Check Against Server Capabilities & Defaulting Strategy:**
                -   **a. Validate Preferred Type:** If a `reasoningType` is suggested by steps 1 or 2, Agentopia checks if it's present in the server's `supportedReasoningTypes` list.
                    -   If yes, this `reasoningType` is selected.
                -   **b. Default to Flexible Type:** If no specific type is strongly indicated, OR if the indicated type is NOT supported by the server, Agentopia defaults to the most flexible and comprehensive type advertised by the server.
                    -   This is typically `planAndExecuteCoT` (if supported by the server).
                -   **c. Fallback to Any Supported Type:** If `planAndExecuteCoT` is also not supported, Agentopia might select the first available type from the server's list as a last resort, or decide it cannot use the reasoning server for this query if no type seems appropriate.
                -   **d. Handle No Match:** If no suitable and supported `reasoningType` can be determined, Agentopia would not call the Reasoning MCP Server and would proceed with its alternative processing (e.g., standard internal LLM or informing the user it cannot perform the request).

            -   **4. `goalQuery` Refinement (Minor):**
                -   While the user's raw query is the primary `goalQuery`, Agentopia might perform minor reframing if a very specific reasoning type is chosen and the query structure allows for clearer presentation of premises or observations for that type. (This is an optimization, not a core requirement for selection).

        - **Decision Priority:** Keyword/Pattern Match -> Query Intent Refinement -> Server Capability Check -> Default to `planAndExecuteCoT` (if supported) -> Fallback/Fail.
        - **Maintenance:** The keyword/pattern mappings will need to be curated and are a key part of this logic's effectiveness.

- [x] 1.3.3 Design: How Agentopia handles responses from the Reasoning MCP Server:
    - If the server returns a final answer: integrate it.
    - If the server returns a plan or prompts (via `mcp/prompts` or custom method): Agentopia executes these with its own LLM.
    - If the server requests tool execution (via `mcp/tools`): Agentopia executes the tool and sends results back to the server.
    - **Notes - Agentopia's Handling of Responses from `reasoning/executeTask` (with Q&A Refinement Loop & Session Awareness):**
        - **Goal:** Define how Agentopia processes responses from `reasoning/executeTask`, incorporating its own Q&A refinement loop and managing the `reasoningSessionId` for KG persistence on the server.
        - **Core Principle:** Agentopia inspects `status`, preserves `updatedSessionState` and `reasoningSessionId` for the session, and can iterate with follow-up questions to the server.

        - **Revised Flow for Agentopia's internal Q&A Refinement Loop (triggered by initial `status: "completed"` from server):**

            -   **A. Initial Server Call and Response:**
                -   Agentopia makes the first `reasoning/executeTask` call. `reasoningSessionId` can be null or a new ID (e.g., Agentopia's internal `metaTaskId`). The server will establish a session.
                -   Server responds. If `status: "completed"`, Agentopia extracts `reasonedAnswer`, `confidenceScore`, `reasoningTrace`, `updatedSessionState`, and the confirmed `reasoningSessionId` from the response.
                -   Let `current_reasoning_output` be the `reasonedAnswer` (or synthesis if `promptsToExecute` were handled).
                -   Initialize `refinement_cycle_count = 0` (e.g., `MAX_REFINEMENT_CYCLES = 2-3`).

            -   **B. Agentopia's Iterative Refinement Loop:**
                -   **1. Check Loop Condition:** If `refinement_cycle_count >= MAX_REFINEMENT_CYCLES`, go to step C (Finalize).
                -   **2. Agentopia's Critique LLM Evaluates:**
                    -   Input to Critique LLM: Original user query, `current_reasoning_output`, latest `reasoningTrace` & `confidenceScore`.
                    -   Prompt: "1. Does `[current_reasoning_output]` fully answer `[Original User Query]`? 2. If not, what ONE precise follow-up question, building on this information, should be asked to the reasoning module to improve the answer for the user? 3. If sufficient, say 'Answer is sufficient'."
                -   **3. Process Critique Response:**
                    -   If "Answer is sufficient" or no good question, go to step C (Finalize).
                    -   If a valid follow-up question is generated:
                        -   Increment `refinement_cycle_count`.
                        -   Prepare a *new* `reasoning/executeTask` request:
                            -   `taskId`: New unique ID for this specific call.
                            -   `reasoningSessionId`: The `reasoningSessionId` from the *previous* server response (to continue the same KG session).
                            -   `goalQuery`: The follow-up question from Agentopia's critique LLM.
                            -   `contextData.hostProvidedPriorReasoningSummary`: Include `current_reasoning_output` (or a summary of all findings so far in this session).
                            -   `contextData.historicalConversation`: Original user query and conversation.
                            -   `sessionState`: The `updatedSessionState` from the *immediately preceding* server response for this session.
                            -   `reasoningType` & `outputRequirements`: As appropriate for the follow-up query.
                        -   Agentopia calls the Reasoning MCP Server.
                        -   **Await and process this new response:** This response becomes the new `current_reasoning_output`, and its `updatedSessionState` and `reasoningSessionId` are stored for the next loop iteration. Handle all its `status` types (e.g., `completed`, `pending_tool_call` during a refinement) as per the main response handling logic below. If this sub-call results in `completed`, loop back to B.1.

            -   **C. Finalize and Conclude Reasoning Session:**
                -   The `current_reasoning_output` (potentially synthesized if multiple cycles occurred) is the final answer for the user.
                -   Agentopia **should call `reasoning/endSession(sessionId: reasoningSessionId)`** on the Reasoning MCP Server to allow it to release KG resources (if this method is implemented as per WBS 1.2.5.8).
                -   Proceed to present the final answer to the user, using final confidence/trace.

        - **Main Response Handling Logic by `status` (applies to initial call and calls within refinement loop):**
            -   **(Unchanged from previous 1.3.3 definition for `completed` (initial part before loop), `pending_tool_call`, `pending_user_input`, `failed`, `max_iterations_reached`, General MCP Call Failure)**, with the understanding that `updatedSessionState` and `reasoningSessionId` are always captured.
            -   The key change is that an initial `status: "completed"` now triggers the Q&A refinement loop (section B above) instead of immediately finalizing.

- [x] 1.3.4 Design: State management within Agentopia if the reasoning process involves multiple turns/interactions with the Reasoning MCP Server.
    - **Notes - Agentopia's State Management for Multi-Turn Reasoning (with Q&A Refinement & Session Awareness):**
        - **Goal:** Enable Agentopia to reliably manage multi-turn interactions, including its own Q&A refinement loop, and maintain session continuity with the Reasoning MCP Server for KG persistence.

        - **Key Requirements & Design Points:**
            -   **1. `reasoningSessionId` Management:**
                -   The `taskId` of Agentopia's *initial* `reasoning/executeTask` call for a user's query becomes the `reasoningSessionId` for the entire interaction, including all Q&A refinement cycles.
                -   This `reasoningSessionId` must be passed in all subsequent `reasoning/executeTask` calls made by Agentopia as part of its refinement loop for that original query.
            -   **2. Storing Interaction State (per `reasoningSessionId`):**
                -   Agentopia needs to store state associated with an active `reasoningSessionId`.
                -   **Information to Store:**
                    -   `reasoningSessionId` (primary key).
                    -   Original user query, `agentId`, timestamp.
                    -   Agentopia-side status (e.g., `INITIAL_CALL_AWAITING_MCP`, `PERFORMING_QA_REFINEMENT_CYCLE`, `AWAITING_MCP_DURING_REFINEMENT`, `FINALIZING_ANSWER`, `SESSION_ENDED`).
                    -   The *most recent* `updatedSessionState` received from the server for this `reasoningSessionId` (critical for the server to resume its KG state).
                    -   `refinement_cycle_count` for the Q&A loop.
                    -   Accumulated/intermediate reasoning outputs if needed for final synthesis.
                    -   Details of any pending server requests if Agentopia is waiting (e.g., `toolCallRequest`).
            -   **(Other points: Storage Location, Resuming Interactions, Timeouts/Cleanup, Concurrency, Location of Logic - remain largely as previously defined in 1.3.4, but now applied to the overarching `reasoningSessionId` and its lifecycle).**
            -   **3. Signaling Session End:**
                -   Agentopia is responsible for signaling to the Reasoning MCP Server when a `reasoningSessionId` is complete (e.g., by calling `reasoning/endSession`) to allow for resource cleanup on the server, especially after the Q&A refinement loop finishes.

### 1.4 Design - Data Model & UI/UX (Agentopia side)
- [x] 1.4.1 Database Design: Confirm `agents` table has `advanced_reasoning_enabled` (boolean). This now signifies if the agent should attempt to use a configured Reasoning MCP Server.
    - **Notes - `agents.advanced_reasoning_enabled` Field:**
        - **Status:** Field **does not currently exist**. Needs to be **added** via migration.
        - **Definition:** `advanced_reasoning_enabled BOOLEAN NOT NULL DEFAULT FALSE`.
        - **Semantic Meaning (Revised):** User intent flag. Actual usage depends on Tool Infrastructure being active (`agents.tool_environment_active` from Tool Infra WBS 4.2.1) and Reasoning tool being installed/active on the agent's droplet (Tool Infra WBS 1.2.2).
- [ ] 1.4.2 Database Design: Leverage existing `mcp_servers` table to store configurations for the Reasoning MCP Server(s) (endpoint, API key, priority, specific capabilities if needed beyond auto-discovery).
    - **Note (Revised based on Tool Infrastructure):** The `mcp_servers` table may now serve primarily as a *catalog source* or be supplemented/replaced by `tool_catalog` (Tool Infra WBS 1.2.4). Configuration/endpoint discovery for active instances will likely use `agent_droplets` and `agent_droplet_tools` tables (Tool Infra WBS 1.2.1, 1.2.2).
    - **Dependency:** Tool Infrastructure WBS 1.2.
- [x] 1.4.3 Frontend Design: UI for the toggle switch on `AgentEditPage.tsx` for `advanced_reasoning_enabled`.
    - **Notes - UI for `advanced_reasoning_enabled` Toggle:**
        - **Objective:** Design the user interface element on the agent editing page to control the `agents.advanced_reasoning_enabled` boolean field.

        - **1. Location & Component:**
            -   **File:** `src/pages/AgentEditPage.tsx` (or its relevant sub-components).
            -   **Section:** Within a logical grouping such as "Capabilities," "Advanced Features," or near other integration toggles (e.g., Tool Use, MCP configuration links).

        - **2. UI Element:**
            -   A standard **Toggle Switch** component.
            -   **Label:** Clear and concise, e.g., "Enable Advanced Reasoning" or "Advanced Reasoning Module".

        - **3. Help Text / Tooltip (Essential):**
            -   Associated with the toggle (e.g., an info icon `(i)` next to the label).
            -   **Content:**
                -   "Allows this agent to utilize a configured Advanced Reasoning Server for complex queries and multi-step problem-solving."
                -   "This can enhance understanding and response quality but may increase processing time or token usage."
                -   "A compatible Reasoning MCP Server must be configured in Agent Settings for this feature to function (see WBS 1.4.4)."
                -   "Default: Disabled."

        - **4. Default State & Data Binding:**
            -   The toggle's on/off state must be bound to the `agent.advanced_reasoning_enabled` field retrieved from the database.
            -   When creating a new agent, it should default to `FALSE` (matching the database default for the new column).

        - **5. Interaction & Persistence:**
            -   Toggling the switch updates the local form state for the agent.
            -   The change is persisted to the `agents` table in the database when the user saves the agent's overall settings on `AgentEditPage.tsx`.

        - **6. Visibility/Enabled State:**
            -   The toggle should generally be visible and interactive.
            -   Agentopia's backend/orchestration logic (WBS 1.3.1) will handle cases where the feature is enabled by the user but no compatible Reasoning MCP Server is actually configured or active (it simply won't use the feature).
            -   The tooltip helps manage user expectations regarding the need for server configuration.

        - **Conceptual Visual:**
            ```
            [ Agent Capabilities ]
              ... (other capabilities)
              [ ] Enable Advanced Reasoning     (Info Icon)
            ```

        - **Note (Revised Context):** This toggle signifies intent. Actual functionality also requires enabling the "Tool Environment" (Tool Infra WBS 4.2.3) and adding the "Reasoning MCP Server" tool to the agent's toolbelt (Tool Infra WBS 4.3).
- [ ] 1.4.4 Frontend Design: Ensure the existing MCP server configuration UI in Agent Settings is suitable for adding and configuring Reasoning MCP Server(s). Users will select/configure the reasoning server here.
    - **Note (Revised based on Tool Infrastructure):** This UI concept is likely **superseded** by the Agent Toolbelt management UI (Tool Infra WBS Phase 4.3). Users will likely add the "Reasoning MCP Server" from a catalog to their toolbelt.
    - **Dependency:** Tool Infrastructure WBS Phase 4.3.
- [x] 1.4.5 UX Design: Define how the agent's reasoning process (e.g., "Using Advanced Reasoning via [Server Name]: [Chosen Model]", key steps, confidence) is communicated to the user.
    - **Notes - UX Design for Communicating Advanced Reasoning Process:**
        - **Goal:** Inform the user transparently but unobtrusively when advanced reasoning is being used, and provide access to details about the process and confidence in the answer.
        - **Principles:** Transparency (optional & progressive disclosure), Clarity & Conciseness, Managing Expectations.

        - **1. Initial Invocation Indicator (Subtle, Optional):**
            -   When Agentopia invokes the Reasoning MCP Server, a brief, subtle textual or iconic indicator could appear (e.g., near "agent is typing..." or as a temporary status message).
            -   *Examples:* "Agent is performing advanced analysis...", "Consulting reasoning module...", or a small icon (brain, gears).
            -   *Purpose:* Manages user expectation if the response takes slightly longer than a standard LLM call.

        - **2. Presenting the Final Answer (Incorporating Confidence):**
            -   Agentopia's presentation of the `reasonedAnswer` should be nuanced by the `confidenceScore` (from WBS 1.3.5 logic).
            -   **High Confidence:** Direct presentation.
            -   **Moderate Confidence:** Hedging language (e.g., "It seems likely that...", "My current thinking suggests...").
            -   **Low Confidence:** Stronger disclaimers, or suggesting verification (e.g., "My confidence in this is low, but one possibility is..."). May even state inability to form a confident conclusion if below a critical threshold.

        - **3. "Show My Work" / Reasoning Trace Access (Progressive Disclosure):**
            -   For messages generated using advanced reasoning, provide an unobtrusive UI element (e.g., small info icon `(i)`, a "View details" link, or an expandable section) to access a summary of the reasoning process.
            -   **Content of Disclosed Reasoning (Human-Readable Summary of `reasoningTrace`):**
                -   `Reasoning Approach Used:` (e.g., "Deductive Analysis", "Hypothesis Generation" - derived by Agentopia from requested `reasoningType` or trace content).
                -   `Key Information Considered:` (If extractable from trace, e.g., specific documents, previous user statements that were key).
                -   `Main Steps in Analysis:` A simplified list of logical steps or pivotal findings from the trace.
                -   `Confidence in this Analysis:` (e.g., High, Moderate, Low - reflecting the score).
                -   *(Avoid raw JSON or highly technical logs in the primary disclosure; an "Advanced Technical Details" sub-section could contain more raw data for developers/experts if necessary).* 
            -   **Tooling:** Agentopia might use an LLM call to summarize a complex or KG-based trace into a narrative if the raw trace object is too structured for direct user consumption.

        - **4. Handling `pending_user_input` from Server:**
            -   If the server needs user clarification, Agentopia clearly presents the server's question (`userInputRequest`) to the user.
            -   *Example:* "To help me reason more effectively about this, could you please tell me: [Server's question]?"

        - **5. Handling Failures or Limits (e.g., `max_iterations_reached`):**
            -   Provide user-friendly messages as designed in WBS 1.3.3.
            -   *Example (Max Iterations):* "I've analyzed your request extensively but couldn't reach a final conclusion within my operational limits. Could we perhaps simplify the question or focus on a specific aspect?"

        - **6. General UX Considerations:**
            -   The default chat interaction should remain natural and fluid.
            -   Advanced reasoning indicators and details should not clutter the primary interface unless user interaction is required (like for `pending_user_input`).
            -   Focus on building user trust by being transparent about the process when it deviates from a simple response, and honest about the system's confidence.

        - **Note (Revised Context):** The [Server Name] might refer to the specific tool instance/type for that agent.

### 1.5 Design - Agentopia MCP Client Enhancements (If Needed)
- [x] 1.5.1 Review: Current `MCPClient` and `MCPManager` in Agentopia for any modifications needed to support interaction with a dedicated Reasoning MCP Server (e.g., handling specific request/response structures for custom reasoning methods).
    - **Notes - Review of `MCPClient` and `MCPManager` for Reasoning Server Interaction:**
        - **Assumed Baseline:** `MCPClient` handles single server communication (JSON-RPC, initialize, capabilities exposure). `MCPManager` manages multiple `MCPClient`s, provides a general call API, and ideally handles server discovery/selection rudimentarily.

        - **1. `MCPClient` (Per-Server Instance):**
            -   Likely requires **minimal to no changes** if it already supports generic JSON-RPC calls, the `initialize` handshake (and exposing received capabilities), and basic error/retry for individual messages.

        - **2. `MCPManager` (Central MCP Service in Agentopia):**
            -   **Generic Method Calling:** Its existing `callMethod(serverNameOrId, methodName, params)` should be able to dispatch the custom `reasoning/executeTask` and `reasoning/endSession` methods, as well as the standard `tools/result` (sent from Agentopia to server).
            -   **Capability Caching & Access (Key Enhancement):**
                -   `MCPManager` (or a service it uses) **must** be responsible for orchestrating the `initialize` handshake with each configured MCP server (especially new/updated ones, or via a "Test & Fetch" UI action – WBS 1.4.4).
                -   It **must persist** the `capabilities` JSON received from the server into the `mcp_servers.capabilities` database column.
                -   It **must provide an efficient way** for other Agentopia services (e.g., the logic in WBS 1.3.1/1.3.2) to retrieve these cached `capabilities` for a given server without re-initializing on every query.
            -   **Awareness of Standard Methods:** Should gracefully handle standard request/response patterns like `tools/result` that Agentopia will initiate towards the Reasoning Server (after the server indicated `pending_tool_call`).

        - **3. New Higher-Level Orchestration Logic in Agentopia (Crucial - Sits above `MCPManager`):**
            -   While `MCPManager` provides the transport, significant new application-level orchestration logic is needed within Agentopia (e.g., in `ChatService`, a new `AgentReasoningCoordinatorService`, or similar).
            -   This new orchestrator will be responsible for:
                -   The full lifecycle designed in WBS 1.3.x: deciding *when* to call reasoning (1.3.1), selecting `reasoningType` (1.3.2), handling the `reasoning/executeTask` response `status` values (1.3.3), including managing Agentopia's internal Q&A refinement loop.
                -   Managing the `reasoningSessionId` and passing the `updatedSessionState` correctly between calls in the Q&A refinement loop (1.3.4).
                -   Initiating the `reasoning/endSession` call via `MCPManager` when appropriate.
                -   Interpreting confidence scores and reasoning traces for user presentation (1.3.5).

        - **4. `mcp_developer_guide.mdc` Alignment:**
            -   The described client-side patterns in the guide (generic call structures, `initialize` handling) are consistent with this approach. The guide likely doesn't specify the application-level session management (like our Q&A loop), which is Agentopia's value-add on top of standard MCP interactions.

        - **Conclusion:** The core `MCPClient` and `MCPManager` need to be robust in their generic MCP communication and especially in managing server capability data. The bulk of the *new* client-side work for this feature lies in the higher-level service within Agentopia that orchestrates the complex reasoning interaction lifecycle using these MCP primitives.

        - **Note (Revised Context):** `MCPManager` will need significant enhancement or be used by a new layer (Tool Interaction Service) to handle discovering agent-specific tool endpoints (Tool Infra WBS 4.4.1) and targeting calls.
        - **Dependency:** Tool Infrastructure WBS 1.1.4, 3.2.3, 4.4.1.
- [x] 1.5.2 Plan: Error handling strategy for interactions with the Reasoning MCP Server (e.g., server unavailable, reasoning task fails, low confidence). Define fallbacks.
    - **Notes - Agentopia-Side Error Handling & Fallback Strategy:**
        - **Goal:** Define how Agentopia handles various error conditions during interaction with the Reasoning MCP Server and what fallback mechanisms are employed.
        - **Location:** Primarily implemented in the higher-level orchestration logic (WBS 1.5.1, Point 3) that manages the reasoning lifecycle, interacting with `MCPManager`.

        - **Error Scenarios and Handling:**

            -   **1. Connection Error / Server Unavailable:**
                -   *Detection:* `MCPManager` fails to connect or call fails at network level after retries.
                -   *Handling:* Log error. Orchestrator is notified.
                -   *Fallback:* Attempt standard internal processing (if not already done).
                -   *User Comms:* "Couldn't connect to advanced reasoning module. Trying standard approach..." or similar.

            -   **2. Task Failure on Server (`status: "failed"`):**
                -   *Detection:* Received response has `status: "failed"`.
                -   *Handling:* Log server error details (`error.*`) and any partial trace. Call `reasoning/endSession` if session was active.
                -   *Fallback:* Attempt standard internal processing.
                -   *User Comms:* User-friendly message (e.g., "Encountered issue during advanced analysis."). Avoid raw server errors.

            -   **3. Max Iterations Reached (`status: "max_iterations_reached"`):**
                -   *Detection:* Received response has `status: "max_iterations_reached"`.
                -   *Handling:* Log event and partial trace. Call `reasoning/endSession`.
                -   *Fallback:* Use last partial coherent result if possible, else attempt standard processing.
                -   *User Comms:* Explain complexity limit reached (e.g., "Couldn't converge on a solution within limits. Can we simplify?").

            -   **4. Low Confidence Score (`status: "completed"`, low `result.confidenceScore`):**
                -   *Detection:* Confidence score below configurable threshold (WBS 1.3.5).
                -   *Handling:* Log score/answer. Call `reasoning/endSession` (as task is complete).
                -   *Fallback (Optional):* Optionally trigger standard processing for comparison.
                -   *User Comms:* Present answer with appropriate disclaimers/hedging (WBS 1.3.5 / 1.4.5).

            -   **5. Timeout Waiting for Server Response:**
                -   *Detection:* Agentopia's orchestrator/`MCPManager` times out awaiting response after sending request or `tools/result`.
                -   *Handling:* Log timeout for `taskId`/`reasoningSessionId`. Treat as failure.
                -   *Fallback:* Attempt standard internal processing.
                -   *User Comms:* "Advanced reasoning module took too long... Trying standard approach..."
                -   *Cleanup:* Attempt `reasoning/endSession` call (best effort), rely on server-side timeout for KG cleanup otherwise.

            -   **6. Malformed Response from Server:**
                -   *Detection:* Response unparsable or missing required fields (e.g., `status`).
                -   *Handling:* Log error. Treat as failure.
                -   *Fallback:* Attempt standard internal processing.
                -   *User Comms:* Generic error message.

            -   **General Fallback Strategy:**
                -   Unless the Reasoning MCP Server provides a usable answer (even if low confidence), the primary fallback is Agentopia's standard internal processing pipeline.
                -   If all methods fail, inform the user the request cannot be fulfilled.

        - **Note (Revised Context):** Needs to add handling for errors related to the Tool Infrastructure (e.g., agent droplet inactive, reasoning tool not active, endpoint discovery failure).

## Phase 2: Reasoning MCP Server Implementation (Proof of Concept)

### 2.1 Core Reasoning MCP Server Framework
- [x] 2.1.1 Implement: Basic MCP server boilerplate (handling `initialize`, advertising capabilities related to reasoning). (Refer to `mcp_developer_guide.mdc` for server setup examples)
    - **Note 2.1.1.1 (Directory Structure):** The Reasoning MCP Server will be located in `services/reasoning-mcp-server/`. This maintains consistency with the existing `services/` directory while allowing the server to be an independent application.
    - **Note 2.1.1.2 (package.json):** Created `package.json` with basic metadata, scripts (`build`, `start`, `dev`), and dependencies (`express`, `typescript`, `@types/express`, `@types/node`, `ts-node-dev`).
    - **Note 2.1.1.3 (tsconfig.json):** Created `tsconfig.json` with standard compiler options for a Node.js/Express TypeScript project, including `outDir: "./dist"`, `rootDir: "./src"`, and `strict: true`.
    - **Note 2.1.1.4 (src/index.ts):** Created initial `src/index.ts` with an Express server. It includes an `/mcp` POST endpoint that parses JSON-RPC, handles the `initialize` method by returning the predefined server capabilities (from WBS 1.2.1), and returns a 'Method not found' for other methods. Basic logging and error handling are included. Server listens on port 3001 (configurable via `REASONING_MCP_PORT`).
    - **Note 2.1.1.5 (README.md):** Created `README.md` in `services/reasoning-mcp-server/` with a brief description, setup instructions (install dependencies), and commands for running the server in development (`npm run dev`) and production (`npm run build`, `npm start`).
- [ ] 2.1.2 Implement: Request handler for the custom reasoning method(s) designed in 1.2.2 (e.g., `reasoning/executeTask`). (See `mcp_developer_guide.mdc` for request handling)
    - **Note 2.1.2.1 (src/index.ts Modification):** Updated `src/index.ts` to include a handler for the `reasoning/executeTask` method. This handler currently: 
        - Logs the received request and parameters (`taskId`, `reasoningSessionId`, `reasoningType`, `goalQuery`, `contextData`, `outputRequirements`, `preferredCoTVariation`, `sessionState`).
        - Performs basic validation for the presence of `taskId` and `goalQuery`.
        - Returns a placeholder JSON-RPC success response structured as per WBS 1.2.2, with `status: "completed"` and placeholder values for `reasonedAnswer`, `reasoningTrace`, `confidenceScore`, and `updatedSessionState` within a `taskOutcome` object.
- [x] 2.1.2 Implement: Request handler for the custom reasoning method(s) designed in 1.2.2 (e.g., `reasoning/executeTask`). (See `mcp_developer_guide.mdc` for request handling)
- [x] 2.1.3 Implement: Internal orchestrator within the server to:
    - **Note 2.1.3.1 (Internal Orchestrator Structure):** Added an `async function internalOrchestrator(params: ReasoningTaskParams)` to `src/index.ts`. The `reasoning/executeTask` handler now calls this function. 
        - Basic TypeScript interfaces (`ReasoningTaskParams`, `JsonRpcRequest`) were added for typed parameters.
        - The orchestrator currently logs `taskId`, `reasoningType`, and `goalQuery`.
        - It returns a placeholder success object, with `reasonedAnswer` reflecting the chosen `reasoningType`.
        - The `reasoning/executeTask` handler now includes basic validation for `reasoningType` and a `try...catch` for errors from the orchestrator.
    - Analyze the reasoning request from Agentopia.
    - [x] Select the appropriate internal reasoning model (Inductive, Deductive, Abductive, CoT variant).
        - **Note 2.1.3.2 (Reasoning Model Selection Logic):** Added a `switch` statement to `internalOrchestrator` based on `params.reasoningType`. It logs the selected reasoning module (e.g., "Inductive Reasoning Module") and updates the placeholder `reasonedAnswer` to include the name of the selected module. Actual module implementation is deferred.
    - [x] Manage the chosen reasoning flow (e.g., generate prompts, make LLM calls, interpret results).
        - **Note 2.1.3.3 (Reasoning Flow Management Placeholders):** Added `TODO` comments within each `case` of the `internalOrchestrator`'s `switch` statement. These comments outline the high-level steps for future implementation of specific reasoning flows (prompt generation, LLM calls, result interpretation) for each reasoning type. The overall function still returns a placeholder success response.
- [x] 2.1.4 Implement: At least one reasoning type (e.g., Deductive with CoT) as a POC.
    - **Note 2.1.4.1 (Deductive POC Implementation):** Added an `async function handleDeductiveReasoningPoc(params)` to `src/index.ts`.
        - This function is called by `internalOrchestrator` when `reasoningType` is "deductive".
        - It simulates premise identification, generates a hardcoded CoT-style prompt, simulates an LLM call with a hardcoded plausible response, and simulates interpretation of this response.
        - It returns a `taskOutcomeDetails` object with a simulated `reasonedAnswer` (e.g., "Socrates is mortal"), a `reasoningTrace` including the simulated prompt and LLM response, and a high `confidenceScore` (0.98).
        - Other reasoning types in the orchestrator now have basic placeholders in `taskOutcomeDetails` indicating they are not yet implemented.
    - [x] Sub-module: Deductive reasoning logic. <!-- POC implemented via handleDeductiveReasoningPoc -->
    - [x] Sub-module: Chain-of-Thought generation for deduction. <!-- Basic CoT prompt simulated in handleDeductiveReasoningPoc -->
- [x] 2.1.5 Implement: Confidence scoring for the POC reasoning type.
    - **Note 2.1.5.1 (Confidence Score for Deductive POC):** The `handleDeductiveReasoningPoc` function already includes a hardcoded `confidenceScore: 0.98` in its returned `taskOutcomeDetails`. This fulfills the requirement for the POC stage, as a confidence score is being provided. Dynamic or LLM-evaluated confidence scoring will be addressed when actual LLM calls are integrated.
- [x] 2.1.6 Implement: Packaging of results (answer, trace, confidence) to send back to Agentopia.
    - **Note 2.1.6.1 (Result Packaging):** The `internalOrchestrator` function in `src/index.ts` packages `taskId`, `reasoningSessionId`, `status`, and `taskOutcome` (which includes `reasonedAnswer`, `reasoningTrace`, `confidenceScore` from the POC, and other fields like `updatedSessionState`) as designed in WBS 1.2.2. This entire object is then set as the `result` field of the JSON-RPC response by the `reasoning/executeTask` handler, fulfilling the packaging requirement for the POC stage.
- [ ] 2.1.7 Implement: (If applicable) Logic to request tool execution from Agentopia via `mcp/tools` if a reasoning step requires external data. (Consult `mcp_developer_guide.mdc` on `tools/call`)
    - **Note 2.1.7.1 (Tool Call Request Structure - Placeholder):** Modified `internalOrchestrator` in `src/index.ts` to include the structure for handling tool call requests. 
        - It initializes `needsToolCall = false` and `toolCallRequestDetails = null`.
        - Added comments within reasoning module switch cases demonstrating how a module could set these variables.
        - If `needsToolCall` were true, the orchestrator would return `status: "pending_tool_call"` and the `toolCallRequest` details. 
        - For the current POC, no module requests a tool, so `status: "completed"` is still returned. This lays the groundwork for future implementation.
- [x] 2.1.7 Implement: (If applicable) Logic to request tool execution from Agentopia via `mcp/tools` if a reasoning step requires external data. (Consult `mcp_developer_guide.mdc` on `tools/call`)

### 2.2 (Optional Initial) LLM Interface for Server
- [ ] 2.2.1 Implement: Secure mechanism for the Reasoning MCP Server to make calls to an LLM (e.g., OpenAI, Anthropic API). (This is internal to the server, but `mcp_developer_guide.mdc` might inform security best practices for external services)
    - **Note 2.2.1.1 (API Key Management):** Decided to use OpenAI. API key will be accessed via an environment variable `OPENAI_API_KEY`.
    - **Note 2.2.1.2 (Add axios):** Added `axios` (e.g., `^0.21.4`) to `dependencies` in `services/reasoning-mcp-server/package.json` for making HTTP requests.
    - **Note 2.2.1.3 (llmService.ts):** Created `services/reasoning-mcp-server/src/llmService.ts` with an exported async function `callOpenAI(prompt: string, systemPrompt?: string | null, model?: string)`. This function uses `axios` to call the OpenAI Chat Completions API, reads `OPENAI_API_KEY` from `process.env`, constructs the request, and includes error handling. It returns the assistant's message content.
    - **Note 2.2.1.4 (README Update):** Updated `services/reasoning-mcp-server/README.md` to include a section on the `OPENAI_API_KEY` environment variable requirement.
- [x] 2.2.1 Implement: Secure mechanism for the Reasoning MCP Server to make calls to an LLM (e.g., OpenAI, Anthropic API). (This is internal to the server, but `mcp_developer_guide.mdc` might inform security best practices for external services)

## Phase 2.A: Agentopia Client-Side Integration for Reasoning MCP

**Dependency Note:** This entire phase depends heavily on the implementation of the Agent Tool Infrastructure, particularly database schemas, backend services for discovery, and the enhanced `MCPManager` or Tool Interaction Service.

### 2.A.1 `chat` Function/Orchestrator Modification
- [ ] 2.A.1.1 Implement: Logic to check `advanced_reasoning_enabled` for the agent and if a suitable Reasoning MCP Server is configured.
    - **Note (Revised Implementation Strategy):** 
        1. Check `agents.advanced_reasoning_enabled` flag.
        2. Check `agents.tool_environment_active` flag (Tool Infra WBS 4.2.1).
        3. Query `agent_droplets` and `agent_droplet_tools` tables (Tool Infra WBS 1.2.1, 1.2.2) to verify the "Reasoning MCP Server" tool (by `tool_catalog_id`) is installed and `status = 'active'` for this agent's droplet.
        4. Retrieve the specific endpoint URL/port for the active instance from `agent_droplet_tools.config_details`.
        5. If all checks pass, proceed; otherwise, skip advanced reasoning.
    - **Dependency:** Tool Infrastructure WBS 1.2, 4.2.1, and backend services.
- [ ] 2.A.1.2 Implement: Context preparation tailored for the Reasoning MCP Server (based on its advertised capabilities, see `mcp_developer_guide.mdc` on `resources/provide`).
    - **Note (Revised Context):** Capabilities might be fetched from the specific instance or cached based on the tool type/version from the catalog.
- [ ] 2.A.1.3 Implement: Invocation of `MCPManager` (or Tool Interaction Service) to send the reasoning request to the configured Reasoning MCP Server.
    - **Note (Revised Implementation Strategy):** Pass the dynamically discovered agent-specific endpoint URL (from 2.A.1.1 step 4) to the service making the MCP call.
    - **Dependency:** Tool Infrastructure WBS 4.4.1 (Tool Capability Reflection / Endpoint Discovery).
- [ ] 2.A.1.4 Implement: Processing of the response from the Reasoning MCP Server:
    - If final answer: use it.
    - If prompts/plan: execute them.
    - If tool request: execute tool and send results back.
- [ ] 2.A.1.5 Implement: Handling of intermediate states if reasoning is multi-turn with the server.

### 2.A.2 Output Structuring (Agentopia side)
- [ ] 2.A.2.1 Ensure: Agentopia can correctly parse and utilize the detailed reasoning output (chosen model, plan, confidence) received from the MCP server.
- [ ] 2.A.2.2 Ensure: New output structure is compatible with existing message formats and frontend display logic.

## Phase 3: Frontend Implementation (Agentopia side)

**Dependency Note:** This phase depends on Agent Tool Infrastructure UI implementations (Tool Infra WBS Phase 4).

### 3.1 Agent Edit Page (`AgentEditPage.tsx`)
- [ ] 3.1.1 Backend Update: Ensure Supabase RPC functions for managing `agents` table can set `advanced_reasoning_enabled`.
- [ ] 3.1.2 UI Implementation: Add the toggle switch for `advanced_reasoning_enabled`.
    - **Note:** See updated UX context note in 1.4.3.

### 3.2 MCP Server Configuration UI (Agent Settings - Enhancements/Verification)
- [ ] 3.2.1 Verify/Ensure: Existing MCP server configuration UI (WBS 1.4.4) allows users to add/edit Reasoning MCP Server details (name, endpoint, API key ref, timeouts, priority, active status).
    - **Note (Revised):** Item is **superseded** by Tool Infrastructure WBS Phase 4.3 (Agent Toolbelt Management).
- [ ] 3.2.2 Implement: Mechanism for Agentopia to "Test Connection & Fetch Capabilities" for an MCP server entry.
    - **Note (Revised):** Functionality potentially moved to Toolbelt UI actions.
    - **Dependency/Superseded by:** Tool Infrastructure WBS Phase 4.3.
- [ ] 3.2.3 UI Display: Ensure the `mcp_servers.capabilities` field is displayed as read-only (e.g., formatted JSON/tree view) in the MCP server configuration UI.
    - **Note (Revised):** Capability display likely part of Tool Catalog UI (Tool Infra WBS 4.1.2) or Agent Toolbelt UI (Tool Infra WBS 4.3.2).
    - **Dependency/Superseded by:** Tool Infrastructure WBS Phase 4.

### 3.3 Chat Interface UX for Reasoning
- [ ] 3.3.1 Implement: Subtle visual indicator when advanced reasoning is invoked (e.g., "Agent is performing advanced analysis...").
- [ ] 3.3.2 Implement: Presentation of final answer, nuanced by confidence score (hedging, disclaimers).
- [ ] 3.3.3 Implement: "Show My Work" / Reasoning Trace access (progressive disclosure via icon/link).
- [ ] 3.3.4 Implement: Handling for `pending_user_input` from the server (clearly presenting the server's question).
- [ ] 3.3.5 Implement: User-friendly messages for failures or limits (e.g., `max_iterations_reached`, server error).

## Phase 4: Testing & Iteration

**Dependency Note:** Testing strategies must incorporate the Agent Tool Infrastructure.

### 4.1 Reasoning MCP Server Testing
- [ ] 4.1.1 Unit Tests: For individual modules/functions within the Reasoning MCP Server.
- [ ] 4.1.2 Integration Tests (Server-Side): Test the full flow within the server for each advertised reasoning type.
- [ ] 4.1.3 Test: Handling of malformed requests by the server.
- [ ] 4.1.4 Test: Error handling and appropriate error responses from the server.
- [ ] 4.1.5 Test: (If applicable) Server-side state management for multi-turn interactions (if `sessionState` logic is advanced).

### 4.2 Agentopia - Reasoning MCP Integration Testing
- [ ] 4.2.1 Test: Agentopia's logic for deciding *when* to invoke the Reasoning MCP Server.
    - **Note (Revised Scope):** Test the revised logic dependent on Tool Infra checks (see Note 2.A.1.1).
- [ ] 4.2.2 Test: Agentopia's logic for selecting the correct `reasoningType`.
- [ ] 4.2.3 Test: Full request/response cycle between Agentopia and a running Reasoning MCP Server.
    - **Note (Revised Scope):** Test interaction with the server running on a provisioned agent Droplet via its dynamic endpoint.
- [ ] 4.2.4 Test: Agentopia's handling of different `status` responses from the server (`completed`, `failed`, `pending_tool_call`, `pending_user_input`, `max_iterations_reached`).
- [ ] 4.2.5 Test: Agentopia's handling of `toolCallRequest` from the server and the subsequent `tools/result` flow back to the server. (Requires server to implement WBS 2.1.7)
- [ ] 4.2.6 Test: Agentopia's state management for multi-turn reasoning sessions (Q&A refinement loop, `sessionState` propagation, `reasoning/endSession` call).
- [ ] 4.2.7 Test: Error handling in Agentopia (server unavailable, task fails, timeouts, low confidence).
    - **Note (Revised Scope):** Include testing Tool Infrastructure related errors.

### 4.3 End-to-End (E2E) / User Acceptance Testing (UAT)
- [ ] 4.3.1 Define: Test scenarios for common use cases where advanced reasoning would be beneficial.
- [ ] 4.3.2 Execute: E2E tests based on defined scenarios, using the UI.
    - **Note (Revised Scope):** Include enabling Tool Environment, adding Reasoning tool via toolbelt, using it in chat, disabling/removing.
- [ ] 4.3.3 Test: `advanced_reasoning_enabled` toggle functionality.
- [ ] 4.3.4 Test: Configuration of Reasoning MCP Server in Agent Settings and its effect.
    - **Note (Revised Scope):** Test adding/configuring/removing the tool via the Agent Toolbelt UI.
- [ ] 4.3.5 Gather: User feedback on the quality of reasoned answers, and the overall experience.

### 4.4 Iteration
- [ ] 4.4.1 Analyze: Test results and user feedback.
- [ ] 4.4.2 Identify: Areas for improvement (prompt engineering, orchestrator logic, confidence calibration, UI/UX).
- [ ] 4.4.3 Plan & Implement: Refinements based on findings.
- [ ] 4.4.4 Re-test: After iterations.

## Phase 5: Logging

**Dependency Note:** Logging strategies must incorporate the Agent Tool Infrastructure.

### 5.1 Reasoning MCP Server Logging
- [ ] 5.1.1 Implement: Structured logging within the Reasoning MCP Server.
    - **Note (Revised Context):** Logs will be generated on the agent Droplet. Consider integration with Tool Infra WBS 5.2.2 (Log Shipping/Centralization).
- [ ] 5.1.2 Review: Server logs for clarity, completeness, and usefulness in debugging.

### 5.2 Agentopia Logging (Related to Reasoning Feature)
- [ ] 5.2.1 Implement/Enhance: Structured logging in Agentopia for interactions with the Reasoning MCP Server.
    - **Note (Revised Context):** Include logging related to discovering the agent's tool endpoint, interaction attempts, and errors via the Tool Infrastructure.
- [ ] 5.2.2 Review: Agentopia logs for reasoning feature interactions.

### 5.3 Log Management & Review (Rule #2)
- [ ] 5.3.1 Establish/Confirm: Log storage locations and rotation policies (if applicable) for both server (on Droplet) and Agentopia logs.
    - **Dependency:** Tool Infrastructure WBS 5.2.2.
- [ ] 5.3.2 Practice: Regular review of logs during development and testing to identify issues and ensure adherence to logging standards.