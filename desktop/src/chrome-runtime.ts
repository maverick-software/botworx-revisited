import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {readFile,lstat,mkdir,writeFile,rm,readdir} from 'node:fs/promises';import {createHash,randomUUID} from 'node:crypto';import path from 'node:path';
import manifest from './chrome-runtime-manifest.json';
import {validateToolDescriptor} from './plugin-validation';
import type {ChromeMode,ChromeStatus} from './chrome-contracts';
import {ChromeContext} from './chrome-context';
type Session={owner:string;mode:ChromeMode;epoch:string;phase:ChromeStatus['phase'];controller:AbortController;client:Client;transport:StdioClientTransport;tools:any[];queue:Promise<unknown>;staged:Map<string,number>;error?:string};
export class ChromeRuntime{
 readonly context=new ChromeContext(this);
 async contextOperation<T>(owner:string,signal:AbortSignal,guard:()=>Promise<void>,run:(invoke:(name:string,args:Record<string,unknown>)=>Promise<any>)=>Promise<T>):Promise<T>{
  const session=this.sessions.get(owner);this.signature(owner);
  const operation=session!.queue.catch(()=>{}).then(async()=>{
   const check=async()=>{signal.throwIfAborted();await guard();if(this.sessions.get(owner)!==session||session!.phase!=='connected'||session!.controller.signal.aborted)throw Error('The Chrome connection changed. Select the tab again.');};
   await check();const result=await run(async(name,args)=>{
    if(!['list_pages','evaluate_script'].includes(name)||!session!.tools.some(tool=>tool.name===name))throw Error('Chrome page context is unavailable. Reconnect Chrome.');
    await check();const value=await session!.client.callTool({name,arguments:args},{signal:AbortSignal.any([signal,session!.controller.signal]),timeout:15000});await check();return value;
   });await check();return result;
  });session!.queue=operation.catch(()=>{});return operation;
 }
 private sessions=new Map<string,Session>();private connecting=new Map<string,AbortController>();private verified?:Promise<void>;
 constructor(private resources:string,private directory:string,private executable=process.execPath,private chromeExecutable?:string){}
 async chrome(){
  const candidates=this.chromeExecutable?[this.chromeExecutable]:[path.join(process.env.PROGRAMFILES??'C:/Program Files','Google/Chrome/Application/chrome.exe'),path.join(process.env['PROGRAMFILES(X86)']??'C:/Program Files (x86)','Google/Chrome/Application/chrome.exe'),path.join(process.env.LOCALAPPDATA??'','Google/Chrome/Application/chrome.exe')];
  for(const file of candidates)try{if((await lstat(file)).isFile())return file;}catch{}return undefined;
 }
 private verify(){return this.verified??= (async()=>{const root=path.resolve(this.resources,'chrome-mcp');for(const [name,hash] of Object.entries(manifest.files)){const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw new Error('Invalid bundled Chrome runtime path.');const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||createHash('sha256').update(await readFile(file)).digest('hex')!==hash)throw new Error('The bundled Chrome tools failed integrity verification. Reinstall Agentopia.');}})();}
 async status(owner:string):Promise<ChromeStatus>{const session=this.sessions.get(owner);return {phase:this.connecting.has(owner)?'connecting':session?.phase??'disconnected',mode:session?.mode??'existing',version:manifest.version,chromeFound:!!await this.chrome(),toolCount:session?.tools.length??0,...(session?.error?{error:session.error}:{})};}
 ready(owner:string){return this.sessions.get(owner)?.phase==='connected';}
 signature(owner:string){const s=this.sessions.get(owner);if(!s||s.phase!=='connected')throw new Error('Connect Chrome in the Chrome DevTools plugin before using its tools.');return manifest.version+':'+s.epoch+':'+s.mode;}
 private async stopSession(owner:string){const s=this.sessions.get(owner);if(!s)return;s.controller.abort();this.sessions.delete(owner);await s.client.close().catch(()=>{});await s.transport.close().catch(()=>{});await this.clearInputs(owner);}
 async disconnect(owner:string){this.connecting.get(owner)?.abort();this.connecting.delete(owner);await this.stopSession(owner);}
 private async clearInputs(owner:string){const root=path.resolve(this.directory,'chrome-tools',owner,'private-inputs');let entries;try{entries=await readdir(root,{withFileTypes:true});}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}for(const entry of entries){if(!entry.isDirectory()||entry.isSymbolicLink()||!/^[a-f0-9-]{36}$/i.test(entry.name))continue;const target=path.resolve(root,entry.name);if(!target.startsWith(root+path.sep))throw new Error('Invalid Chrome input cleanup path.');await rm(target,{recursive:true,force:true});}}
 async close(){await Promise.all([...new Set([...this.sessions.keys(),...this.connecting.keys()])].map(owner=>this.disconnect(owner)));}
 async connect(owner:string,mode:ChromeMode,guard:()=>Promise<void>){
  if(!/^[a-f0-9-]{36}$/i.test(owner)||!['existing','dedicated'].includes(mode))throw new Error('Choose an Agentopia account and Chrome connection mode.');if(this.connecting.has(owner))throw new Error('A Chrome connection is already waiting. Approve Chrome’s prompt or cancel it.');
  const controller=new AbortController();this.connecting.set(owner,controller);try{
  await guard();controller.signal.throwIfAborted();await this.stopSession(owner);await this.verify();controller.signal.throwIfAborted();const chrome=await this.chrome();if(!chrome)throw new Error('Install Google Chrome to use this plugin. The embedded Agentopia browser remains available.');
  const root=path.join(this.directory,'chrome-tools',owner);await mkdir(root,{recursive:true});for(const name of ['artifacts','private-inputs'])await mkdir(path.join(root,name),{recursive:true,mode:0o700});await this.clearInputs(owner);controller.signal.throwIfAborted();
  const args=[path.join(this.resources,'chrome-mcp',manifest.entry),'--no-usage-statistics','--no-performance-crux','--experimental-structured-content','--filesystem-root='+path.join(root,'artifacts'),'--filesystem-root='+path.join(root,'private-inputs'),'--blocked-url-pattern=file://*','--blocked-url-pattern=chrome://*','--blocked-url-pattern=chrome-extension://*','--blocked-url-pattern=devtools://*','--experimental-vision','--screenshot-format=jpeg','--screenshot-quality=70','--screenshot-max-width=1280','--screenshot-max-height=1000',...(mode==='existing'?['--autoConnect','--channel=stable']:['--executable-path='+chrome,'--user-data-dir='+path.join(root,'profile')])];
  const env:Record<string,string>={ELECTRON_RUN_AS_NODE:'1',CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS:'1',NODE_OPTIONS:''};for(const key of ['SYSTEMROOT','WINDIR','TEMP','TMP','USERPROFILE','HOMEDRIVE','HOMEPATH','LOCALAPPDATA','APPDATA','PATH'])if(process.env[key])env[key]=process.env[key]!;
  const transport=new StdioClientTransport({command:this.executable,args,env,cwd:root,stderr:'pipe',maxBufferSize:4*1024*1024}),client=new Client({name:'Agentopia Chrome plugin',version:'0.31.0'},{versionNegotiation:{mode:'auto'}}),s:Session={owner,mode,epoch:randomUUID(),phase:'connecting',controller,client,transport,tools:[],queue:Promise.resolve(),staged:new Map()};this.sessions.set(owner,s);
  // Drain diagnostics without sending browser logs or local paths to an AI provider.
  transport.stderr?.on('data',()=>{});client.onclose=()=>{if(this.sessions.get(owner)===s&&s.phase==='connected'){s.phase='error';s.error='Chrome disconnected. Reconnect the plugin before trying another operation.';s.epoch=randomUUID();}};
  const signal=AbortSignal.any([s.controller.signal,AbortSignal.timeout(90000)]);
  try{
   await client.connect(transport,{signal,timeout:20000});const tools:any[]=[];let cursor:string|undefined;do{const page=await client.listTools(cursor?{cursor}:undefined,{signal,timeout:20000});for(const tool of page.tools){validateToolDescriptor(tool);if(tools.some(t=>t.name===tool.name))throw new Error('The Chrome tool catalog contains duplicate names.');tools.push(tool);}if(tools.length>500)throw new Error('The Chrome tool catalog is unexpectedly large.');cursor=page.nextCursor;}while(cursor);
   const result=await client.callTool({name:'list_pages',arguments:{}},{signal,timeout:75000});if(result.isError)throw new Error('Chrome could not authorize the connection.');await guard();signal.throwIfAborted();if(this.sessions.get(owner)!==s)throw new Error('This Chrome connection was cancelled.');s.tools=tools;s.phase='connected';this.connecting.delete(owner);return this.status(owner);
  }catch(error){const cancelled=s.controller.signal.aborted;await client.close().catch(()=>{});await transport.close().catch(()=>{});if(this.sessions.get(owner)===s){s.phase='error';s.error=cancelled?'Chrome connection cancelled.':mode==='existing'?'Enable Remote debugging in chrome://inspect/#remote-debugging, then connect again and approve Chrome’s permission prompt.':'Chrome could not start its Agentopia profile. Close that profile’s Chrome window and reconnect.';}throw new Error(s.error??'Chrome connection cancelled.',{cause:error});}
 }finally{if(this.connecting.get(owner)===controller)this.connecting.delete(owner);}
 }
 async inventory(owner:string){const s=this.sessions.get(owner);this.signature(owner);return s!.tools;}
 async call(owner:string,name:string,args:Record<string,unknown>,signal:AbortSignal,guard:()=>Promise<void>,context:{conversationId?:string;readInput?:(file:string)=>Promise<Buffer>}={}){
  const s=this.sessions.get(owner);this.signature(owner);if(!s!.tools.some(t=>t.name===name))throw new Error('This Chrome tool is unavailable. Discover the current catalog.');
  const operation=s!.queue.catch(()=>{}).then(async()=>{
   signal.throwIfAborted();await guard();if(this.sessions.get(owner)!==s||s!.phase!=='connected')throw new Error('The Chrome connection changed during review.');
   const safeArgs={...args},ownerRoot=path.resolve(this.directory,'chrome-tools',owner),folder=path.join(ownerRoot,'artifacts',context.conversationId&&/^[a-f0-9-]{36}$/i.test(context.conversationId)?context.conversationId:'manual'),inputRoot=path.join(ownerRoot,'private-inputs'),inputs=path.join(inputRoot,randomUUID());
   let retainInputs=false;try{
    // Inputs are staged from attached workspace files; output paths stay in owned artifacts.
    let inputCount=0,inputBytes=0;
    const input=async(value:unknown)=>{if(typeof value!=='string'||!context.readInput||++inputCount>10)throw new Error('Attach the local file to this chat before using it in Chrome.');const bytes=await context.readInput(value);inputBytes+=bytes.length;if(inputBytes>40*1024*1024)throw new Error('Chrome file inputs exceed 40 MB.');if([...s!.staged.values()].reduce((a,b)=>a+b,0)-(s!.staged.get(inputs)??0)+inputBytes>100*1024*1024)throw new Error('Chrome upload staging reached 100 MB. Disconnect Chrome to clear staged files, then reconnect.');s!.staged.set(inputs,inputBytes);await mkdir(inputs,{recursive:true,mode:0o700});const extension=path.extname(value);const target=path.join(inputs,String(inputCount)+(/^[.a-zA-Z0-9]{1,12}$/.test(extension)?extension:'.bin'));await writeFile(target,bytes,{flag:'wx',mode:0o600});return target;};
    if(safeArgs.sourcePath!==undefined){if(typeof safeArgs.sourcePath!=='string'||!context.readInput||safeArgs.function!==undefined)throw new Error('Choose one attached JavaScript source file or an inline function.');const bytes=await context.readInput(safeArgs.sourcePath),source=bytes.toString('utf8');if(bytes.includes(0)||!Buffer.from(source,'utf8').equals(bytes)||source.length>160000)throw new Error('Chrome scripts must be UTF-8 JavaScript smaller than 160,000 characters.');safeArgs.function=source;delete safeArgs.sourcePath;}
    if(safeArgs.filePaths!==undefined){if(!Array.isArray(safeArgs.filePaths)||!safeArgs.filePaths.length)throw new Error('Choose local files attached to this chat.');const selected=[];for(const file of safeArgs.filePaths)selected.push(await input(file));safeArgs.filePaths=selected;}
    for(const key of Object.keys(safeArgs).filter(k=>/path$/i.test(k)&&k!=='sourcePath')){
     const value=safeArgs[key];if(typeof value!=='string'||!value)continue;const absolute=path.resolve(folder,value);
     if(path.isAbsolute(value)){if(!absolute.startsWith(path.resolve(folder)+path.sep))throw new Error('Chrome artifact paths must stay in this conversation’s Chrome artifacts folder.');}
     else if(value.includes('/')||value.includes('\\')||!/^[-a-zA-Z0-9][-.a-zA-Z0-9 _]{0,127}$/.test(value)||/[<>:"|?*]/.test(value))throw new Error('Use a simple file name for Chrome output. Agentopia stores it in this conversation’s artifacts folder.');
     await mkdir(folder,{recursive:true});safeArgs[key]=absolute;
    }
    signal.throwIfAborted();await guard();const result=await s!.client.callTool({name,arguments:safeArgs},{signal:AbortSignal.any([signal,s!.controller.signal]),timeout:90000});await guard();signal.throwIfAborted();retainInputs=name==='upload_file'&&inputCount>0;return result;
   }finally{
    // This fresh UUID directory is always strictly beneath this owner's input staging root.
    if(!path.resolve(inputs).startsWith(path.resolve(inputRoot)+path.sep))throw new Error('Invalid Chrome input cleanup path.');if(!retainInputs||this.sessions.get(owner)!==s){s!.staged.delete(inputs);await rm(inputs,{recursive:true,force:true});}
   }
  });s!.queue=operation.catch(()=>{});return operation;
 }
}
