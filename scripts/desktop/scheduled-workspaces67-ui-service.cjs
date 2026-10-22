const path=require('node:path');
exports.create=function({build,owner,secrets,workspaces,files,runs,out}){
 const {ScheduledWorkspaceMaintenance}=require(path.join(build,'scheduled-workspace-maintenance.js')),{WorkspaceEditor}=require(path.join(build,'workspace-editor.js')),{WorkspaceTools}=require(path.join(build,'workspace-tools.js'));
 let exclusive=false,hold,failRestore=false;const interrupted=new Map(),reveals=[],editor=new WorkspaceEditor(secrets,new WorkspaceTools(files,[out])),save=secrets.setMany.bind(secrets);
 secrets.scheduledWorkspaceIds=who=>{if(who!==owner)return [];return [...secrets.values.keys()].filter(key=>key.startsWith('scheduled-workspace:'+who+':')).map(key=>key.split(':').at(-1));};
 secrets.scheduledWorkspaceRecoveryIds=who=>{if(who!==owner)return [];return [...secrets.values.keys()].filter(key=>key.startsWith('scheduled-workspace-recovery:'+who+':')).map(key=>key.split(':').at(-1));};
 secrets.setMany=async entries=>{await save(entries);if(hold&&!hold.entered&&entries.some(([key,value])=>key.startsWith('scheduled-workspace-recovery:'+owner+':')&&value.phase==='creating')){hold.entered=true;hold.enter();await hold.promise;}};
 const guard=async who=>{if(who!==owner)throw Error('Foreign UI fixture owner');};
 const maintenance=new ScheduledWorkspaceMaintenance(secrets,workspaces,path.join(out,'private-recovery'),{
  guard,busy:()=>false,exclusive:async work=>{if(exclusive)throw Error('Generated exclusive operation is already active');exclusive=true;try{return await work();}finally{exclusive=false;}},withFiles:(who,paths,work)=>editor.fileOperation(who,paths,work),
  state:async(who,journal)=>{await guard(who);const run=runs.find(row=>row.id===journal.runId),saved=interrupted.get(journal.runId);return {run:run?.status??null,request:saved?'interrupted':null,...(saved?{requestFingerprint:JSON.stringify([journal.requestId,'interrupted','controlled-revision']),conversationId:saved}:{})};},references:who=>files.list(who),
  forget:async(who,root)=>{await guard(who);for(const ref of files.list(who)){const relative=path.relative(root,ref.path);if(ref.source!=='clipboard'&&(relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)))await files.remove(who,ref.id);}},
  attach:async(who,folder,check)=>{if(failRestore&&path.basename(folder).startsWith('restored-')){failRestore=false;throw Error('Controlled interrupted restore publication');}return (await files.attach(who,[{path:folder}],check)).selected[0];},reveal:async folder=>reveals.push(folder)
 });
 const rpc=async(action,args)=>{await guard(args.owner);switch(action){
  case 'tasks.workspaces.list':return maintenance.list(owner);
  case 'tasks.workspaces.prepare':return maintenance.prepare(owner,args.runId);
  case 'tasks.workspaces.commit':return maintenance.commit(owner,args.id);
  case 'tasks.workspaces.restore':return maintenance.restore(owner,args.id);
  case 'tasks.workspaces.open':return maintenance.open(owner,args.runId);
  case 'tasks.workspaces.cancel':return maintenance.cancel(owner,args.runId);
  case 'tasks.workspaces.inspect':return maintenance.inspect(owner,args.kind,args.runId,args.id);
  case 'tasks.workspaces.acknowledge':return maintenance.acknowledge(owner,args.id);
  case 'tasks.workspaces.reveal':return maintenance.reveal(owner,args.id);
  case 'tasks.workspaces.revealRestored':return maintenance.revealRestored(owner,args.id,args.restorationId);
  default:throw Error('Unsupported generated maintenance UI operation');
 }};
 return {maintenance,rpc,reveals,holdNextPreparation(){let enter,release;const started=new Promise(resolve=>enter=resolve),promise=new Promise(resolve=>release=resolve);hold={enter,promise,entered:false};return {started,release:()=>{release();hold=undefined;}};},failRestorePublicationOnce(){failRestore=true;},interrupt(run,conversation){interrupted.set(run,conversation);}};
};
