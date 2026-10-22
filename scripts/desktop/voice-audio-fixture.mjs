// Supplies known speech to the real recorder without using the owner's microphone.
export async function installVoiceAudio(page,wave){
 await page.evaluate(async encoded=>{
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),create=AudioContext.prototype.createBufferSource;
  const fixture={controllers:[],tracks:[],outputStarts:0,outputStops:0};globalThis.__voiceAudio=fixture;
  AudioContext.prototype.createBufferSource=function(){const context=this,node=create.call(this),connect=node.connect.bind(node),start=node.start.bind(node),stop=node.stop.bind(node);let output=false;node.connect=(target,...args)=>{if(target===context.destination)output=true;return connect(target,...args);};node.start=(...args)=>{if(output)fixture.outputStarts++;return start(...args);};node.stop=(...args)=>{if(output)fixture.outputStops++;return stop(...args);};return node;};
  navigator.mediaDevices.getUserMedia=async constraints=>{if(!constraints.audio||constraints.video)throw new Error('The voice fixture only supports microphone capture.');const context=new AudioContext(),target=context.createMediaStreamDestination();const audio=await context.decodeAudioData(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)).buffer);await context.resume();fixture.controllers.push({context,target,audio});fixture.tracks.push(...target.stream.getTracks());return target.stream;};
  fixture.play=async()=>{const c=fixture.controllers.at(-1);if(!c||!fixture.tracks.some(t=>t.readyState==='live'))throw new Error('Start voice capture before playing the fixture.');await c.context.resume();const source=c.context.createBufferSource();source.buffer=c.audio;source.connect(c.target);source.start(0,5.3,5.7);};
  fixture.restore=async()=>{navigator.mediaDevices.getUserMedia=original;AudioContext.prototype.createBufferSource=create;fixture.tracks.forEach(t=>t.stop());for(const c of fixture.controllers)await c.context.close();};
 },wave);
}
