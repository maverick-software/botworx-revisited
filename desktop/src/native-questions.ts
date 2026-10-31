import type {NativeItem} from './native-contracts';

export const questionInstructions=`When you need information, preferences, or clarification from the user, use request_user_input_async to show the question controls. Ask self-contained questions early and offer useful choices when appropriate; free text is always available. Do not put a clarification question only in progress notes or your final answer. Continue useful independent work while the question is unanswered. A preselected option, closed dialog, silence, or elapsed time is not an answer or approval. For an optional preference, give the user reasonable time to respond before proceeding with an explicitly stated reasonable assumption. If an answer is required, leave dependent work pending until the answer arrives. In particular, do not choose an unconfirmed jurisdiction, ownership structure, or other material legal terms and report a jurisdiction-specific document or the entire task as complete. Explain what remains pending and why. Use existing approval controls for permission decisions. Use request_user_input for a question that must block the current turn; its Skip action supplies no answer.`;

export function questionAnswerText(entry:NativeItem,answers:unknown):string{
 const questions=entry.item.type==='agentMessage'?entry.item.questions:null;
 if(!questions?.length||!Array.isArray(answers)||answers.length!==questions.length||answers.some(value=>value!==null&&(typeof value!=='string'||!value.trim()||value.length>10000)))throw Error('Provide an answer or explicitly skip each question.');
 return 'Answers to your questions:\n\n'+questions.map((q,index)=>q.title+'\n'+(answers[index]===null?'[Skipped by the user; no answer or approval was provided.]':String(answers[index]).trim())).join('\n\n');
}

export const questionKey=(entry:Pick<NativeItem,'threadId'|'turnId'|'item'>)=>JSON.stringify([entry.threadId,entry.turnId,entry.item.id]);
