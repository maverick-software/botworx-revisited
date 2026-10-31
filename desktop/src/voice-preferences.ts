export type VoicePreferences={mode:'continuous'|'push';spoken:boolean;deviceId:string;voice:string;rate:number;silenceMs:number;threshold:number;connection:'local'|'sylvana';tier:'standard'|'advanced';managedVoice:string};
export const defaultVoicePreferences:VoicePreferences={mode:'continuous',spoken:true,deviceId:'default',voice:'',rate:0,silenceMs:1000,threshold:.018,connection:'local',tier:'standard',managedVoice:''};
export function workspaceVoicePreferences(value:VoicePreferences,settings:import('./workspace-ai').WorkspaceAI,legal:boolean):VoicePreferences{return {...value,connection:legal?'sylvana':settings.voice.connection,tier:settings.voice.tier,voice:'',managedVoice:settings.voice.voice};}
export function voicePreferences(value:unknown):VoicePreferences{
 const v={...defaultVoicePreferences,...(value as Partial<VoicePreferences>)};
 if(!value||typeof value!=='object'||Array.isArray(value)||!['continuous','push'].includes(v.mode)||typeof v.spoken!=='boolean'||typeof v.deviceId!=='string'||v.deviceId.length>512||typeof v.voice!=='string'||v.voice.length>200||!Number.isInteger(v.rate)||v.rate< -5||v.rate>5||![700,1000,1500,2000].includes(v.silenceMs)||typeof v.threshold!=='number'||![.01,.018,.03].includes(v.threshold))throw new Error('Choose valid voice settings.');
 if(!['local','sylvana'].includes(v.connection)||!['standard','advanced'].includes(v.tier)||typeof v.managedVoice!=='string'||v.managedVoice!==''&&!/^voice-[a-f0-9]{16}$/.test(v.managedVoice))throw Error('Choose a valid voice connection and service level.');
 return {mode:v.mode,spoken:v.spoken,deviceId:v.deviceId||'default',voice:v.voice,rate:v.rate,silenceMs:v.silenceMs,threshold:v.threshold,connection:v.connection,tier:v.tier,managedVoice:v.managedVoice};
}
