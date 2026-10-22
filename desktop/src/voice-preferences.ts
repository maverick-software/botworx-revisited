export type VoicePreferences={mode:'continuous'|'push';spoken:boolean;deviceId:string;voice:string;rate:number;silenceMs:number;threshold:number};
export const defaultVoicePreferences:VoicePreferences={mode:'continuous',spoken:true,deviceId:'default',voice:'',rate:0,silenceMs:1000,threshold:.018};
export function voicePreferences(value:unknown):VoicePreferences{
 const v={...defaultVoicePreferences,...(value as Partial<VoicePreferences>)};
 if(!value||typeof value!=='object'||Array.isArray(value)||!['continuous','push'].includes(v.mode)||typeof v.spoken!=='boolean'||typeof v.deviceId!=='string'||v.deviceId.length>512||typeof v.voice!=='string'||v.voice.length>200||!Number.isInteger(v.rate)||v.rate< -5||v.rate>5||![700,1000,1500,2000].includes(v.silenceMs)||typeof v.threshold!=='number'||![.01,.018,.03].includes(v.threshold))throw new Error('Choose valid voice settings.');
 return {mode:v.mode,spoken:v.spoken,deviceId:v.deviceId||'default',voice:v.voice,rate:v.rate,silenceMs:v.silenceMs,threshold:v.threshold};
}
