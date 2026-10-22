import { ReasoningStep, ReasoningStyle } from './types.ts';

export interface ReasoningAdapter {
  generateSteps(input: { text: string; style: ReasoningStyle; maxSteps: number }): Promise<ReasoningStep[]>;
}


