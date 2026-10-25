import {installValidationGuard76} from './install-live-validation76-guard.mjs';
import {installEnduranceSpend145} from './endurance-spend145.mjs';

export async function installAssistedEndurance145(application){await installValidationGuard76(application);await installEnduranceSpend145(application);await installAssistedCommand145(application);await installEnduranceTrace145(application);}

export async function installAssistedCommand145(application){
 await application.evaluate(({app})=>{
  const req=globalThis.__durableProbeRequire,fs=req('node:fs'),path=req('node:path'),crypto=req('node:crypto'),{CodexHarness}=req(app.getAppPath()+'/build/codex-harness.js'),s=globalThis.__validation76,previous=CodexHarness.prototype.serverRequest;
  s.helperCommands145=[];
  const journal=()=>{if(s.out)fs.writeFileSync(path.join(s.out,'helper-commands.json'),JSON.stringify(s.helperCommands145,null,2));};
  const refuse=message=>{s.blocked.push({at:new Date().toISOString(),message});journal();throw Error(message);};
  CodexHarness.prototype.serverRequest=async function(record,rpc,...rest){
   const c=s.cases[record.request.id]??s.goalCases[record.options.goalId],helper=c?.nativeHelper,p=rpc.params;
   if(helper&&['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(rpc.method)){
    if(!s.leaseActive||record.owner!==s.owner||record.request.agent_id!==c.agent||rpc.method!=='item/commandExecution/requestApproval'||path.resolve(p.cwd).toLowerCase()!==path.resolve(helper.cwd).toLowerCase())return refuse('Only the owned read-only calculation helper in its selected folder is authorized.');
    let command=p.command;for(const quote of ['"',"'"]){const prefix=helper.shellPrefix+' -Command '+quote;if(command.startsWith(prefix)&&command.endsWith(quote))command=command.slice(prefix.length,-1);}
    const match=/^python reconcile145\.py ([1-9]\d?) (\d{1,4}) (\d{1,4})$/.exec(command);if(!match)return refuse('Only the supplied helper and three bounded numeric arguments are authorized.');const stage=Number(match[1]);
    if(stage>helper.count||s.helperCommands145.some(row=>row.agent===c.agent&&row.stage===stage))return refuse('A confirmed or uncertain helper invocation cannot be repeated.');
    const rows=s.tools.filter(row=>row.requestId===record.request.id),opened=rows.filter(row=>row.name==='browser_open'&&row.status==='completed').at(-1),snapshot=rows.findLast(row=>row.name==='browser_snapshot'&&row.status==='completed'&&row.arguments.tab_id===c.tabs.at(-1));
    if(opened?.arguments.url!==c.baseUrl+'/stage'+stage||!snapshot||snapshot.at<opened.finishedAt)return refuse('Read the current batch source before calculating it.');
    const source='batch-'+String(stage).padStart(2,'0')+'.csv';for(const[name,digest]of [[helper.script,helper.sha256],[path.join(helper.cwd,source),helper.sources[source]]]){const info=fs.lstatSync(name);if(info.isSymbolicLink()||!info.isFile()||crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')!==digest)return refuse('The reviewed helper or batch source changed before execution.');}
    s.helperCommands145.push({agent:c.agent,requestId:record.request.id,stage,shipping:Number(match[2]),discount:Number(match[3]),at:new Date().toISOString(),beforeExecution:true});journal();
   }
   return previous.call(this,record,rpc,...rest);
  };
 });
}

// Reuse the passive shutdown boundaries exercised by the accepted146 cold test.
export async function installEnduranceTrace145(application){
 await application.evaluate(({app,ipcMain})=>{
  const req=globalThis.__durableProbeRequire,fs=req('node:fs'),path=req('node:path'),s=globalThis.__validation76,trace=value=>{if(s.out)fs.appendFileSync(path.join(s.out,'lifecycle.jsonl'),JSON.stringify({at:new Date().toISOString(),...value})+'\n');};
  for(const[module,name,method]of [['broker','Broker','shutdown'],['codex-harness','CodexHarness','close'],['runtime','Runtime','stop']]){const Class=req(app.getAppPath()+'/build/'+module+'.js')[name],original=Class.prototype[method];if(typeof original!=='function')throw Error('Shutdown boundary changed');Class.prototype[method]=async function(...args){trace({stage:name+'.'+method,phase:'start'});try{const result=await original.apply(this,args);trace({stage:name+'.'+method,phase:'done'});return result;}catch(error){trace({stage:name+'.'+method,phase:'error',message:String(error.message).slice(0,180)});throw error;}};}
  ipcMain.on('agentopia:close-ready',(_event,value)=>trace({stage:'renderer-close-ready',hasError:!!value?.error}));app.on('browser-window-created',(_event,w)=>{let main=false;w.on('close',()=>{main=!w.webContents.isDestroyed()&&w.webContents.getURL().startsWith('agentopia://app/');if(main)trace({stage:'window-close'});});w.webContents.on('destroyed',()=>{if(main)trace({stage:'webcontents-destroyed'});});});
 });
}
