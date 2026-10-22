export function browserAddress(value:unknown){
 if(typeof value!=='string'||value.length>4000)throw new Error('Enter a browser address.');
 const url=new URL(value);if(url.username||url.password||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Use HTTPS, or HTTP for a local development server.');return url.href;
}
