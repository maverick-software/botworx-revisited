export type SpeechFrame={started:boolean;ended:boolean;audio?:Float32Array[];level:number};
// Continuous capture keeps only a short leading buffer until actual speech starts.
export class SpeechDetector{
 private leading:Float32Array[]=[];private leadingMs=0;private audio:Float32Array[]=[];private active=false;private voiced=0;private silence=0;private duration=0;private attack=0;
 constructor(private sampleRate:number,private threshold=.018,private silenceMs=1000,private minSpeechMs=300,private maxMs=110000){if(!Number.isFinite(sampleRate)||sampleRate<8000)throw new Error('Unsupported microphone sample rate.');}
 reset(){this.leading=[];this.leadingMs=0;this.audio=[];this.active=false;this.voiced=0;this.silence=0;this.duration=0;this.attack=0;}
 flush(){const audio=this.active&&this.voiced>=this.minSpeechMs?this.audio:[];this.reset();return audio;}
 push(input:Float32Array,threshold=this.threshold):SpeechFrame{
  const frame=new Float32Array(input),ms=frame.length/this.sampleRate*1000,level=Math.sqrt(frame.reduce((sum,sample)=>sum+(Number.isFinite(sample)?sample*sample:0),0)/Math.max(1,frame.length));let started=false;
  if(!this.active){this.leading.push(frame);this.leadingMs+=ms;while(this.leading.length>1&&this.leadingMs>350)this.leadingMs-=this.leading.shift()!.length/this.sampleRate*1000;this.attack=level>=threshold?this.attack+ms:0;if(this.attack>=140){this.active=true;started=true;this.audio=this.leading;this.leading=[];this.duration=this.leadingMs;this.leadingMs=0;this.voiced=this.attack;this.silence=0;}}
  else{this.audio.push(frame);this.duration+=ms;if(level>=threshold){this.voiced+=ms;this.silence=0;}else this.silence+=ms;}
  if(this.active&&(this.silence>=this.silenceMs||this.duration>=this.maxMs)){const audio=this.voiced>=this.minSpeechMs?this.audio:undefined;this.reset();return {started,ended:true,audio,level};}
  return {started,ended:false,level};
 }
}
export function speechEcho(text:string,reply:string){const words=(v:string)=>v.toLowerCase().replace(/[^\p{L}\p{N} ]/gu,' ').split(/\s+/).filter(Boolean);const heard=words(text),spoken=words(reply);return heard.length>=5&&spoken.length>=heard.length&&spoken.join(' ').includes(heard.join(' '));}
