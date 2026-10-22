import { ReasoningStyle } from './types.ts';

export class ReasoningSelector {
  static select(messageText: string, toolsAvailable: string[], allowed?: ReasoningStyle[], bias?: ReasoningStyle): ReasoningStyle {
    const pool: ReasoningStyle[] = (allowed && allowed.length ? allowed : ['inductive','abductive','deductive']);
    if (bias && pool.includes(bias)) return bias;
    if (/why|because|cause|leads to/i.test(messageText) && pool.includes('abductive')) return 'abductive';
    if (/prove|must|necessarily|if\s+then/i.test(messageText) && pool.includes('deductive')) return 'deductive';
    if (/pattern|examples?|generalize/i.test(messageText) && pool.includes('inductive')) return 'inductive';
    // Tool hint → prefer abductive (hypothesis & test)
    if (toolsAvailable.length && pool.includes('abductive')) return 'abductive';
    return pool[0];
  }
}


