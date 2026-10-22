import { useState, useCallback, useRef } from 'react';
import type { AIState, ToolExecutionStatus } from '@/components/AIThinkingIndicator';
import type { Message } from '@/types';
import { ToolCategorizer } from '@/lib/toolCategorization';

interface ProcessStep {
  label: string;
  completed: boolean;
  startTime?: Date;
  details?: string;
}

export function useAIProcessing(agent: any, user: any, input: string) {
  const [aiState, setAiState] = useState<AIState | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolExecutionStatus | null>(null);
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState<number | null>(null);
  const [currentProcessingDetails, setCurrentProcessingDetails] = useState<any>(null);
  const isMounted = useRef(true);

  const updateAIState = useCallback((state: AIState) => {
    setAiState(state);
  }, []);

  const addStepResponse = useCallback((stepName: string, response: string) => {
    setProcessSteps(prev => prev.map(step => 
      step.label.toLowerCase().includes(stepName.toLowerCase())
        ? { ...step, details: response }
        : step
    ));
  }, []);

  const startAIProcessing = useCallback((setMessages?: React.Dispatch<React.SetStateAction<Message[]>>) => {
    setAiState('thinking');
    setProcessSteps([
      { label: 'Understanding request', completed: false, startTime: new Date() },
      { label: 'Analyzing tools', completed: false },
      { label: 'Planning response', completed: false },
      { label: 'Generating response', completed: false },
    ]);
    
    // Add a thinking message to show the agent status card
    if (setMessages) {
      setMessages(prev => {
        // Check if there's already a thinking message
        const hasThinking = prev.some(msg => msg.role === 'thinking' && !msg.metadata?.isCompleted);
        if (hasThinking) return prev;
        
        const thinkingMessage: Message = {
          role: 'thinking',
          content: 'Thinking...',
          timestamp: new Date(),
          agentId: agent?.id,
          userId: user?.id,
          metadata: { isCompleted: false },
        };
        
        const newMessages = [...prev, thinkingMessage];
        setThinkingMessageIndex(newMessages.length - 1);
        return newMessages;
      });
    } else {
      setThinkingMessageIndex(null);
    }
  }, [agent?.id, user?.id]);

  const completeAIProcessing = useCallback((
    success: boolean = true, 
    setMessages?: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    setAiState(success ? 'completed' : 'failed');
    setProcessSteps(prev => prev.map(step => ({ ...step, completed: true })));
    
    // If failed and setMessages provided, remove the thinking message
    if (!success && setMessages) {
      setMessages(prev => prev.filter(msg => 
        !(msg.role === 'thinking' && !msg.metadata?.isCompleted)
      ));
    }
    
    setTimeout(() => {
      setAiState(null);
      setCurrentTool(null);
      setThinkingMessageIndex(null);
    }, 500);
  }, []);

  const completeAIProcessingWithResponse = useCallback(async (
    responseContent: string,
    additionalMetadata: any = {},
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    setAiState('completed');
    
    const completedSteps = await new Promise<typeof processSteps>((resolve) => {
      setProcessSteps(prevSteps => {
        const done = prevSteps.map(step => ({ ...step, completed: true }));

        setMessages(prev => {
          const updated = [...prev];
          let thinkingIndex = -1;
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'thinking' && !updated[i].metadata?.isCompleted) {
              thinkingIndex = i;
              break;
            }
          }
          
          if (thinkingIndex !== -1) {
            updated[thinkingIndex] = {
              role: 'assistant',
              content: responseContent,
              timestamp: new Date(),
              agentId: agent?.id,
              userId: user?.id,
              metadata: { 
                isCompleted: true,
                processingDetails: currentProcessingDetails,
                ...additionalMetadata
              },
              aiProcessDetails: {
                steps: done,
                totalDuration: Date.now() - (done[0]?.startTime?.getTime() || Date.now()),
                toolsUsed: done.filter(s => s.details).map(s => s.details || '')
              }
            };
          } else {
            updated.push({
              role: 'assistant',
              content: responseContent,
              timestamp: new Date(),
              agentId: agent?.id,
              userId: user?.id,
              metadata: { isCompleted: true, ...additionalMetadata },
              aiProcessDetails: {
                steps: done,
                totalDuration: Date.now() - (done[0]?.startTime?.getTime() || Date.now()),
                toolsUsed: done.filter(s => s.details).map(s => s.details || '')
              }
            });
          }
          return updated;
        });
        
        return done;
      });
      requestAnimationFrame(() => resolve(processSteps));
    });
    
    setTimeout(() => {
      setAiState(null);
      setCurrentTool(null);
      setThinkingMessageIndex(null);
    }, 500);
  }, [agent?.id, currentProcessingDetails, processSteps]);

  const simulateAIProcessing = useCallback(async () => {
    updateAIState('thinking');
    await new Promise(resolve => setTimeout(resolve, 800));
    addStepResponse('thinking', `User asked: "${input}"\nI need to understand what they're asking for and determine the best way to help them.`);

    updateAIState('analyzing_tools');
    await new Promise(resolve => setTimeout(resolve, 600));
    const detectedCategories = ToolCategorizer.categorizeByContent(input);
    if (detectedCategories.length > 0) {
      addStepResponse('analyzing', `Detected potential tool categories: ${detectedCategories.map(c => c.category).join(', ')}`);
    }

    updateAIState('planning');
    await new Promise(resolve => setTimeout(resolve, 700));
    addStepResponse('planning', `Planning the best approach to address the user's request...`);

    updateAIState('generating_response');
    addStepResponse('generating', `Formulating a comprehensive response...`);
  }, [input, updateAIState, addStepResponse]);

  return {
    aiState,
    setAiState,
    currentTool,
    setCurrentTool,
    processSteps,
    setProcessSteps,
    thinkingMessageIndex,
    setThinkingMessageIndex,
    currentProcessingDetails,
    setCurrentProcessingDetails,
    isMounted,
    startAIProcessing,
    completeAIProcessing,
    completeAIProcessingWithResponse,
    simulateAIProcessing,
    updateAIState,
    addStepResponse,
  };
}

