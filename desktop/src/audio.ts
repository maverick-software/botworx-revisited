export function pcmWave(chunks:Float32Array[],sampleRate:number):ArrayBuffer{
 const length=chunks.reduce((sum,c)=>sum+c.length,0),source=new Float32Array(length);let offset=0;for(const chunk of chunks){source.set(chunk,offset);offset+=chunk.length;}
 const count=Math.floor(length*16000/sampleRate),buffer=new ArrayBuffer(44+count*2),view=new DataView(buffer);
 const label=(offset:number,text:string)=>{for(let n=0;n<text.length;n++)view.setUint8(offset+n,text.charCodeAt(n));};
 label(0,'RIFF');view.setUint32(4,36+count*2,true);label(8,'WAVE');label(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);label(36,'data');view.setUint32(40,count*2,true);
 for(let n=0;n<count;n++){const from=Math.floor(n*sampleRate/16000),to=Math.max(from+1,Math.floor((n+1)*sampleRate/16000));let value=0;for(let j=from;j<to&&j<source.length;j++)value+=source[j];value=Math.max(-1,Math.min(1,value/(to-from)));view.setInt16(44+n*2,value*(value<0?32768:32767),true);}return buffer;
}
