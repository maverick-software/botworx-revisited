import { ReasoningAdapter } from './reasoning_adapter.ts';
import { ReasoningStep, ReasoningStyle } from './types.ts';

// Minimal stub: returns a single summary step. Implement real prompt call later.
export class OpenAIReasoningAdapter implements ReasoningAdapter {
  constructor(private openai: any) {}
  async generateSteps(input: { text: string; style: ReasoningStyle; maxSteps: number }): Promise<ReasoningStep[]> {
    return [{ step: 1, style: input.style, state: 'analyze', question: 'Reasoning summary', hypothesis: `Analyze: ${input.text.slice(0,120)}`, confidence: 0.7, time_ms: 1 }];
  }
}


