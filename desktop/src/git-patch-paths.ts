// Git quotes pathname bytes using C escapes, including octal UTF-8 bytes.
// Decode the original header: generic patch parsers may already strip quotes.
export function gitPath(value:string){
 if(value.length>8192)throw new Error('The Git pathname exceeds the supported size.');
 if(!value.startsWith('"'))return value;
 if(value.length<2||!value.endsWith('"'))throw new Error('Unterminated Git pathname.');
 const bytes:number[]=[],encoder=new TextEncoder(),escapes:Record<string,number>={a:7,b:8,t:9,n:10,v:11,f:12,r:13,'\\':92,'"':34};
 for(let i=1;i<value.length-1;i++){
  const char=value[i];
  if(char==='"')throw new Error('Unexpected Git pathname quote.');
  if(char==='\\'){
   const next=value[++i];if(i>=value.length-1)throw new Error('Incomplete Git pathname escape.');
   if(next in escapes){bytes.push(escapes[next]);continue;}
   const octal=value.slice(i,i+3);if(!/^[0-7]{3}$/.test(octal)||i+3>value.length-1||parseInt(octal,8)>255)throw new Error('Unsupported Git pathname escape.');bytes.push(parseInt(octal,8));i+=2;
  }else{const point=value.codePointAt(i)!;if(point>=0xd800&&point<=0xdfff)throw new Error('Invalid Git pathname Unicode.');bytes.push(...encoder.encode(String.fromCodePoint(point)));if(point>0xffff)i++;}
 }
 return new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes));
}
export function patchFilename(value:string|undefined,prefix:string){
 if(!value||value==='/dev/null')return null;const decoded=gitPath(value);
 if(!decoded.startsWith(prefix+'/'))throw new Error('The patch filename is not relative to its workspace.');
 const name=decoded.slice(prefix.length+1).replace(/\\/g,'/');if(!name||name.length>500||name.split('/').some(p=>p==='..'||p===''||p==='.')||/[:\x00-\x1f\x7f]/.test(name))throw new Error('The patch contains an unsafe filename.');return name;
}
// Header-only empty files use the same pathname on both sides. Trying each
// separator keeps spaces (including " b/") inside a valid filename intact.
export function emptyPatchNames(header:string){
 const raw=header.replace(/^diff --git /,''),pairs:{from:string;to:string}[]=[];
 if(raw.length>16384)throw new Error('The empty Git patch header exceeds the supported size.');
 for(let i=0;i<raw.length;i++)if(raw[i]===' '){try{const from=patchFilename(raw.slice(0,i),'a'),to=patchFilename(raw.slice(i+1),'b');if(from&&from===to)pairs.push({from,to});}catch{/* Not a pathname boundary. */}}
 if(pairs.length!==1)throw new Error('The empty Git patch filename is ambiguous.');return pairs[0];
}
