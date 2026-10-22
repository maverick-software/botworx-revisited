import { useState, useCallback } from 'react';
import { ToolCategorizer } from '../lib/toolCategorization';
import { AI_STATE_LABELS, CHAT_CONSTANTS } from '../constants/chat';
import type { AIProcessingState, Agent } from '../types/chat';
import type { AIState, ToolExecutionStatus } from '../components/AIThinkingIndicator';
import type { Message } from '../types';

export function useAIProcessing(agent: Agent | null, user: any) {
  const [aiProcessingState, setAIProcessingState] = useState<AIProcessingState>({
    aiState: null,
    currentTool: null,
    showAIIndicator: false,
    processSteps: [],
    thinkingMessageIndex: null,
    currentProcessingDetails: null,
  });

  const updateAIProcessingState = useCallback((updates: Partial<AIProcessingState>) => {
    setAIProcessingState(prev => ({ ...prev, ...updates }));
  }, []);

  const startAIProcessing = useCallback((setMessages: React.Dispatch<React.SetStateAction<Message[]>>) => {
    updateAIProcessingState({
      showAIIndicator: true,
      aiState: 'thinking',
      currentTool: null,
      processSteps: [],
    });
    
    // Add thinking message to chat
    const thinkingMessage: Message = {
      role: 'thinking',
      content: 'Processing your request...',
      timestamp: new Date(),
      agentId: agent?.id,
      userId: user?.id,
      metadata: { isCompleted: false },
      aiProcessDetails: { steps: [], toolsUsed: [] }
    };
    
    setMessages(prev => {
      const newMessages = [...prev, thinkingMessage];
      updateAIProcessingState({ thinkingMessageIndex: newMessages.length - 1 });
      return newMessages;
    });
  }, [agent?.id, user?.id, updateAIProcessingState]);

  const updateAIState = useCallback((newState: AIState, toolInfo?: Partial<ToolExecutionStatus>) => {
    updateAIProcessingState({ aiState: newState });
    
    if (toolInfo) {
      setAIProcessingState(prev => ({
        ...prev,
        currentTool: { ...prev.currentTool, ...toolInfo } as ToolExecutionStatus
      }));
    }
    
    // Add step to process tracking
    const stepLabel = AI_STATE_LABELS[newState] || 'Processing';
    const enhancedLabel = toolInfo?.toolName ? `Using ${toolInfo.toolName}` : stepLabel;
    
    setAIProcessingState(prev => {
      const existingIndex = prev.processSteps.findIndex(step => step.state === newState);
      const newStep = {
        state: newState,
        label: enhancedLabel,
        startTime: new Date(),
        completed: false,
        details: toolInfo?.provider ? `Using ${toolInfo.provider}` : undefined
      };
      
      if (existingIndex >= 0) {
        // Update existing step
        const updated = [...prev.processSteps];
        updated[existingIndex] = { ...updated[existingIndex], ...newStep };
        return { ...prev, processSteps: updated };
      } else {
        // Add new step and mark previous as completed
        const updated = prev.processSteps.map(step => ({ ...step, completed: true }));
        return { ...prev, processSteps: [...updated, newStep] };
      }
    });
  }, [updateAIProcessingState]);

  // Function to add response data to current step
  const addStepResponse = useCallback((state: AIState, response: string) => {
    setAIProcessingState(prev => {
      const updated = [...prev.processSteps];
      let stepIndex = -1;
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].state === state) {
          stepIndex = i;
          break;
        }
      }
      if (stepIndex >= 0) {
        updated[stepIndex] = { ...updated[stepIndex], response };
      }
      return { ...prev, processSteps: updated };
    });
  }, []);

  // Function to add tool call data to current step
  const addStepToolCall = useCallback((state: AIState, toolCall: string, toolResult?: any) => {
    setAIProcessingState(prev => {
      const updated = [...prev.processSteps];
      let stepIndex = -1;
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].state === state) {
          stepIndex = i;
          break;
        }
      }
      if (stepIndex >= 0) {
        updated[stepIndex] = { 
          ...updated[stepIndex], 
          toolCall,
          ...(toolResult && { toolResult })
        };
      }
      return { ...prev, processSteps: updated };
    });
  }, []);

  const completeAIProcessing = useCallback((
    success: boolean = true,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    updateAIProcessingState({ aiState: success ? 'completed' : 'failed' });
    
    // Mark all steps as completed
    setAIProcessingState(prev => ({
      ...prev,
      processSteps: prev.processSteps.map(step => ({ ...step, completed: true }))
    }));
    
    // Update thinking message to completed state
    if (aiProcessingState.thinkingMessageIndex !== null) {
      setMessages(prev => {
        const updated = [...prev];
        if (updated[aiProcessingState.thinkingMessageIndex!]?.role === 'thinking') {
          updated[aiProcessingState.thinkingMessageIndex!] = {
            ...updated[aiProcessingState.thinkingMessageIndex!],
            metadata: { isCompleted: true },
            aiProcessDetails: {
              steps: aiProcessingState.processSteps.map(step => ({ ...step, completed: true })),
              totalDuration: Date.now() - (aiProcessingState.processSteps[0]?.startTime?.getTime() || Date.now()),
              toolsUsed: aiProcessingState.processSteps.filter(s => s.details).map(s => s.details || '')
            }
          };
        }
        return updated;
      });
    }
    
    // Clean up state
    setTimeout(() => {
      updateAIProcessingState({
        showAIIndicator: false,
        aiState: null,
        currentTool: null,
        thinkingMessageIndex: null,
      });
    }, CHAT_CONSTANTS.CLEANUP_TIMEOUT);
  }, [aiProcessingState.thinkingMessageIndex, aiProcessingState.processSteps, updateAIProcessingState]);

  const completeAIProcessingWithResponse = useCallback(async (
    responseContent: string,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    updateAIProcessingState({ aiState: 'completed' });
    
    // Mark all steps as completed
    const completedSteps = await new Promise<typeof aiProcessingState.processSteps>((resolve) => {
      setAIProcessingState(prevState => {
        const done = prevState.processSteps.map(step => ({ ...step, completed: true }));

        // Find and convert the thinking message to assistant response
        setMessages(prev => {
          const updated = [...prev];
          // Find the most recent thinking message
          let thinkingIndex = -1;
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'thinking' && !updated[i].metadata?.isCompleted) {
              thinkingIndex = i;
              break;
            }
          }
          
          if (thinkingIndex !== -1) {
            // Convert to assistant message with thinking details
            updated[thinkingIndex] = {
              role: 'assistant',
              content: responseContent,
              timestamp: new Date(),
              agentId: agent?.id,
              userId: user?.id,
              metadata: { isCompleted: true },
              aiProcessDetails: {
                steps: done,
                totalDuration: Date.now() - (done[0]?.startTime?.getTime() || Date.now()),
                toolsUsed: done.filter(s => s.details).map(s => s.details || '')
              }
            };
          } else {
            // Fallback: Add new assistant message if no thinking message found
            updated.push({
              role: 'assistant',
              content: responseContent,
              timestamp: new Date(),
              agentId: agent?.id,
              userId: user?.id,
              metadata: { isCompleted: true },
              aiProcessDetails: {
                steps: done,
                totalDuration: Date.now() - (done[0]?.startTime?.getTime() || Date.now()),
                toolsUsed: done.filter(s => s.details).map(s => s.details || '')
              }
            });
          }
          return updated;
        });
        
        return { ...prevState, processSteps: done };
      });
      // Resolve in next tick to ensure setState above applied
      requestAnimationFrame(() => resolve(aiProcessingState.processSteps));
    });

    // Clean up state
    setTimeout(() => {
      updateAIProcessingState({
        showAIIndicator: false,
        aiState: null,
        currentTool: null,
        thinkingMessageIndex: null,
      });
    }, CHAT_CONSTANTS.CLEANUP_TIMEOUT);
  }, [agent?.id, user?.id, aiProcessingState.processSteps, updateAIProcessingState]);

  // Simulate AI processing phases
  const simulateAIProcessing = useCallback(async (input: string) => {
    // Phase 1: Thinking
    updateAIState('thinking');
    await new Promise(resolve => setTimeout(resolve, CHAT_CONSTANTS.AI_PROCESSING_DELAYS.THINKING));
    addStepResponse('thinking', `User asked: "${input}"\nI need to understand what they're asking for and determine the best way to help them. Let me analyze this message and see if I need to use any tools or if I can respond directly.`);

    // Phase 2: Analyzing tools
    updateAIState('analyzing_tools');
    await new Promise(resolve => setTimeout(resolve, CHAT_CONSTANTS.AI_PROCESSING_DELAYS.ANALYZING_TOOLS));
    
    const detectedCategories = ToolCategorizer.categorizeByContent(input);
    const toolAnalysis = detectedCategories.length > 0;
    const categoryLabels = detectedCategories.map(cat => cat.label).join(', ');
    
    addStepResponse('analyzing_tools', `Checking available tools for this request...\nTool categories detected: ${categoryLabels || 'None'}\nAvailable tools: Email integration, Web search, File operations\nDecision: ${toolAnalysis ? `Will use ${categoryLabels} tools` : 'No tools needed for this request'}`);

    // Phase 3: Check if we might execute a tool
    const mightUseTool = toolAnalysis;

    if (mightUseTool) {
      // Phase 4: Tool execution
      const primaryCategory = ToolCategorizer.getPrimaryCategory(detectedCategories);
      const toolProvider = primaryCategory?.id === 'email' ? 'email_service' : primaryCategory?.id || 'tool';
      
      updateAIState('executing_tool', {
        toolName: `${toolProvider}_action`,
        provider: toolProvider,
        status: 'executing',
        startTime: new Date(),
      });
      
      const toolAction = primaryCategory?.id === 'email' ? 'send_email' : 
                        primaryCategory?.id === 'web' ? 'web_search' :
                        primaryCategory?.id === 'docs' ? 'create_document' :
                        'execute_action';
      
      addStepToolCall('executing_tool', 
        `${toolProvider}.${toolAction}({
  ${primaryCategory?.id === 'email' ? 
    `to: "user@example.com",
  subject: "Response to your inquiry",
  body: "Thank you for your message..."` :
  primaryCategory?.id === 'web' ? 
    `query: "search terms from user message",
  type: "comprehensive"` :
    `action: "process_request"`}
})`,
        {
          success: true,
          [primaryCategory?.id === 'email' ? 'message_id' : 
           primaryCategory?.id === 'web' ? 'results_count' : 
           'operation_id']: primaryCategory?.id === 'email' ? "msg_abc123" : 
                           primaryCategory?.id === 'web' ? 5 : "op_xyz789",
          executed_at: new Date().toISOString(),
          category: primaryCategory?.label || 'General'
        }
      );
      
      await new Promise(resolve => setTimeout(resolve, CHAT_CONSTANTS.AI_PROCESSING_DELAYS.TOOL_EXECUTION));

      // Phase 5: Processing results
      updateAIState('processing_results', {
        status: 'completed',
        endTime: new Date(),
      });
      
      const resultMessage = primaryCategory?.id === 'email' ? 'Email sent successfully!' :
                           primaryCategory?.id === 'web' ? 'Web search completed!' :
                           primaryCategory?.id === 'docs' ? 'Document created!' :
                           'Operation completed successfully!';
      
      addStepResponse('processing_results', `Tool execution completed successfully!\n${resultMessage}\nProcessing the result to formulate a response to the user.`);
      
      await new Promise(resolve => setTimeout(resolve, CHAT_CONSTANTS.AI_PROCESSING_DELAYS.PROCESSING_RESULTS));
    }

    // Phase 6: Generating response
    updateAIState('generating_response');
    const toolResults = mightUseTool ? 
      `${ToolCategorizer.getPrimaryCategory(detectedCategories)?.label || 'Tool'} operation completed successfully` : 
      'No tools used';
      
    addStepResponse('generating_response', `Generating final response based on:\n- User's original request: "${input}"\n- Tool results: ${toolResults}\n- Context: Friendly conversation\n\nFormulating helpful and conversational response...`);
    
    await new Promise(resolve => setTimeout(resolve, CHAT_CONSTANTS.AI_PROCESSING_DELAYS.GENERATING_RESPONSE));
  }, [updateAIState, addStepResponse, addStepToolCall]);

  return {
    aiProcessingState,
    updateAIProcessingState,
    startAIProcessing,
    updateAIState,
    addStepResponse,
    addStepToolCall,
    completeAIProcessing,
    completeAIProcessingWithResponse,
    simulateAIProcessing,
  };
}
