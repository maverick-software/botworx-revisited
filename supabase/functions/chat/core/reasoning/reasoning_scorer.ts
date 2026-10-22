import { ReasoningDecision } from './types.ts';

export class ReasoningScorer {
  static score(text: string, contextDensity: number = 0): ReasoningDecision {
    const lenScore = Math.min(1, text.length / 400);
    const questionBonus = /\?|why|how|explain|compare|derive|prove/i.test(text) ? 0.2 : 0;
    const densityBonus = Math.min(0.3, Math.max(0, contextDensity));
    const score = Math.max(0, Math.min(1, lenScore + questionBonus + densityBonus));
    return { score, reason: `len=${lenScore.toFixed(2)} q=${questionBonus.toFixed(2)} d=${densityBonus.toFixed(2)}` };
  }
}


