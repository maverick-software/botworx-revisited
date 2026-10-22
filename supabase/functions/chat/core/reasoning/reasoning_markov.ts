import { ReasoningState, ReasoningStyle, ReasoningStep } from './types.ts';

type Weights = Record<ReasoningState, Partial<Record<ReasoningState, number>>>;

const baseWeights: Weights = {
  analyze: { hypothesize: 0.7, conclude: 0.3 },
  hypothesize: { test: 0.6, conclude: 0.4 },
  test: { observe: 1.0 },
  observe: { update: 0.8, conclude: 0.2 },
  update: { hypothesize: 0.7, conclude: 0.3 },
  conclude: {},
};

export class ReasoningMarkov {
  private weights: Weights;
  private style: ReasoningStyle;
  private tools: string[];
  private facts: string[];
  constructor(opts?: { style?: ReasoningStyle; toolsAvailable?: string[]; facts?: string[] }) {
    this.weights = JSON.parse(JSON.stringify(baseWeights));
    this.style = opts?.style || 'inductive';
    this.tools = opts?.toolsAvailable || [];
    this.facts = opts?.facts || [];
    // Adjust transition weights dynamically per style
    if (this.style === 'abductive') {
      this.bump('analyze', 'hypothesize', 0.2);
      this.bump('hypothesize', 'test', 0.25);
      this.bump('observe', 'update', 0.2);
    } else if (this.style === 'deductive') {
      this.bump('analyze', 'conclude', 0.35);
      this.bump('hypothesize', 'conclude', 0.2);
    } else if (this.style === 'inductive') {
      this.bump('analyze', 'observe', 0.3);
      this.bump('observe', 'update', 0.2);
      this.bump('update', 'conclude', 0.2);
    }
    // If tools are available, make tests more likely
    if (this.tools.length) {
      this.bump('hypothesize', 'test', 0.2);
      this.bump('analyze', 'test', 0.1);
    }
  }

  private bump(from: ReasoningState, to: ReasoningState, delta: number) {
    const row = (this.weights[from] = this.weights[from] || {});
    row[to] = (row[to] || 0) + delta;
  }

  next(current: ReasoningState, infoGap: number, confidence: number): ReasoningState {
    const w = { ...this.weights[current] };
    if (current === 'analyze' || current === 'hypothesize') {
      w.test = (w.test || 0) + Math.max(0, Math.min(0.3, infoGap));
    }
    if (current === 'observe' || current === 'update') {
      w.conclude = (w.conclude || 0) + Math.max(0, Math.min(0.3, confidence));
    }
    const entries = Object.entries(w) as Array<[ReasoningState, number]>;
    const total = entries.reduce((s, [,v]) => s + v, 0) || 1;
    let r = Math.random() * total;
    for (const [state, v] of entries) { r -= v; if (r <= 0) return state; }
    return 'conclude';
  }

  run(style: ReasoningStyle, maxSteps: number, ask: (q: string) => Promise<string>, shouldTest: (s: string) => Promise<{needed:boolean, tool?:string, args?:any, gap:number}>,
      observe: (action?: {tool?:string; name?:string; args?:any}) => Promise<any>): Promise<ReasoningStep[]> {
    return (async () => {
      const steps: ReasoningStep[] = [];
      let state: ReasoningState = 'analyze';
      let confidence = 0.5;
      let infoGap = 0.0;
      for (let i=1; i<=maxSteps; i++) {
        const question = this.buildQuestion(style, state);
        const hypothesis = await ask(question);
        let action: any = undefined; let observation: any = undefined; let conclusion: string|undefined;
        if (state === 'hypothesize' || state === 'analyze') {
          const test = await shouldTest(hypothesis);
          infoGap = test.gap;
          if (test.needed) { action = { tool: test.tool, name: test.tool, args: test.args }; observation = await observe(action); }
        }
        if (state === 'conclude') { conclusion = hypothesis; confidence = Math.min(0.95, confidence + 0.2); steps.push({ step:i, style, state, question, hypothesis, observation, conclusion, confidence, time_ms: 1 }); break; }
        steps.push({ step:i, style, state, question, hypothesis, action, observation, confidence, time_ms: 1 });
        state = this.next(state, infoGap, confidence);
      }
      return steps;
    })();
  }

  private buildQuestion(style: ReasoningStyle, state: ReasoningState): string {
    const facts = this.facts && this.facts.length
      ? `Facts:\n- ${this.facts.slice(0, 5).join('\n- ')}`
      : '';
    const toolHint = this.tools && this.tools.length
      ? `Tools available: ${this.tools.join(', ')}`
      : '';

    const promptHeader = [facts, toolHint].filter(Boolean).join('\n');

    const q = (s: string) => (promptHeader ? `${promptHeader}\n\n${s}` : s);

    if (style === 'inductive') {
      switch (state) {
        case 'analyze': return q('What patterns or regularities are most evident in the facts?');
        case 'hypothesize': return q('Given these patterns, what general rule best accounts for them?');
        case 'test': return q('If that rule were true, what immediate prediction follows that we can check now?');
        case 'observe': return q('Considering the available evidence, does the prediction appear supported or contradicted?');
        case 'update': return q('Refine the rule so that it better fits all observed facts. What is the refined rule?');
        case 'conclude': return q('State the most probable general rule in one sentence.');
      }
    }

    if (style === 'abductive') {
      switch (state) {
        case 'analyze': return q('Which observations are most salient or surprising in the facts?');
        case 'hypothesize': return q('What is the most plausible explanation that would make these observations expected?');
        case 'test': return q('If that explanation were correct, what evidence should we expect to observe?');
        case 'observe': return q('Relative to that expectation, what evidence is present or missing?');
        case 'update': return q('Revise the explanation to best fit the totality of evidence. What is the revised explanation?');
        case 'conclude': return q('State the best current explanation in one sentence.');
      }
    }

    // deductive
    switch (state) {
      case 'analyze': return q('Which rules or constraints apply directly to this case?');
      case 'hypothesize': return q('Applying those rules, what conclusion follows for this case?');
      case 'test': return q('What intermediate inference can be derived that supports that conclusion?');
      case 'observe': return q('Do the premises required for that inference hold in the described case?');
      case 'update': return q('Adjust the inference so that all premises are satisfied. What is the adjusted inference?');
      case 'conclude': return q('State the necessary conclusion that follows, in one sentence.');
    }
    return q('What conclusion follows?');
  }
}


