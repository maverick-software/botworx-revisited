export type ReasoningStyle = 'inductive' | 'abductive' | 'deductive';

export type ReasoningState = 'analyze' | 'hypothesize' | 'test' | 'observe' | 'update' | 'conclude';

export interface ReasoningStep {
  step: number;
  style: ReasoningStyle;
  state: ReasoningState;
  question: string;
  hypothesis?: string;
  action?: { tool?: string; name?: string; args?: any };
  observation?: any;
  update?: string;
  conclusion?: string;
  confidence: number;
  time_ms: number;
}

export interface ReasoningDecision {
  score: number;
  selectedStyle?: ReasoningStyle;
  reason?: string;
}

export interface ReasoningOptions {
  enabled: boolean;
  mode: 'summary' | 'trace';
  threshold?: number;
  max_steps?: number;
  max_tool_calls?: number;
  styles_allowed?: ReasoningStyle[];
  style_bias?: ReasoningStyle;
  budget_tokens?: number;
  timeout_ms?: number;
}


