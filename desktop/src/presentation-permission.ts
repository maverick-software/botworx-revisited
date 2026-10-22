// Only the application's main frame can use user-activated fullscreen.
// Document/browser subframes and automatic fullscreen remain denied.
export function presentationFullscreenAllowed(permission:string,ownContents:boolean,details:{isMainFrame?:boolean;requestingUrl?:string}){
 if(permission!=='fullscreen'||!ownContents||details.isMainFrame!==true||!details.requestingUrl)return false;
 try{const url=new URL(details.requestingUrl);return url.protocol==='agentopia:'&&url.hostname==='app'&&!url.username&&!url.password&&!url.port;}catch{return false;}
}
