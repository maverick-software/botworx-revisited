import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useBuilderResources,readBuilderResources,applyBuilderResources} from '../../desktop/ui/useBuilderResources';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',creationId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',agentId='dddddddd-dddd-4ddd-8ddd-dddddddddddd',requestId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const digest='a'.repeat(64),initial=()=>({version:1,id:'11111111-1111-4111-8111-111111111111',owner,creationId,revision:1,writeId:'22222222-2222-4222-8222-222222222222',grants:[{name:'existing',digest},{name:'retained-missing',digest}],boundAgentId:null,boundRevision:null});
let scope:any=initial(),calls:any[]=[],fail='',delay='',release:(()=>void)|null=null;
const app=(name:string,extra:any={})=>({name,description:'Public '+name,displayName:name,version:'1',digest,enabled:true,configured:true,kind:'mcp',package:{mcp:{},secret:'PRIVATE_CONNECTION_MARKER'},assignments:[],...extra});
let plugins:any[]=[],skills:any[]=[];
const reset=()=>{scope=initial();calls=[];fail='';delay='';release=null;plugins=[app('existing',{assignments:[{agent_id:agentId,enabled:true,connection_ids:['private-connection']}]}),app('add'),app('disabled',{enabled:false}),app('service',{kind:'composio-service',configured:false}),app('composio',{configured:false}),app('retained',{enabled:false,assignments:[{agent_id:agentId,enabled:true}]}),app('peer',{assignments:[{agent_id:other,enabled:true}]})];skills=[{id:'standalone-skill',name:'Research',description:'Public research skill',scope:'account',enabled:true,revision:1,files:{'SKILL.md':'PRIVATE_SKILL_FILE_MARKER'},assignments:[]},{id:'inline',name:'Inline',scope:'agent',description:'Inline',files:{},revision:1,enabled:true,assignments:[]}];};reset();
async function rpc(action:string,args:any={}){
 calls.push({action,args:structuredClone(args)});
 if(delay===action){delay='';await new Promise<void>(resolve=>{release=resolve;});}
 if(action==='creationTools.catalog')return structuredClone({scope:{...scope,owner:args.owner},retirement:null,plugins,skills:skills.filter(row=>row.scope==='account').map(row=>({...row,name:row.id,displayName:row.name,digest,configured:true}))});
 if(action==='plugins.list')return structuredClone(plugins);
 if(action==='skills.list')return structuredClone({skills,agents:[]});
 if(action==='creationTools.write'){
  if(fail==='write-before'){fail='';throw Error('Controlled rejected write');}
  if(args.input.expectedRevision!==scope.revision)throw Error('Controlled stale revision');
  scope={...scope,revision:scope.revision+1,writeId:args.input.writeId,grants:args.input.grants};
  if(fail==='lost-creation'){fail='';throw Error('Controlled lost creation acknowledgement');}return structuredClone(scope);
 }
 if(action==='plugins.assign'||action==='skills.assign'){
  const rows=action==='plugins.assign'?plugins:skills,row=rows.find(row=>action==='plugins.assign'?row.name===args.name:row.id===args.id);
  if(fail==='partial'&&action==='skills.assign'){fail='';throw Error('Controlled partial assignment');}
  const grant=row.assignments.find((grant:any)=>grant.agent_id===args.agentId);if(grant)grant.enabled=args.enabled;else row.assignments.push({agent_id:args.agentId,enabled:args.enabled});
  if(fail==='lost-saved'){fail='';throw Error('Controlled lost saved acknowledgement');}return;
 }
 if(action==='fixture.flush')return;
 throw Error('Unexpected API '+action);
}
Object.assign(window,{agentopia:{call:rpc}});
let api:any={};
function Hook({mode,account}:{mode:string;account:string}){
 const result=useBuilderResources({owner:account,source:mode==='saved'?agentId:null,creationId,beforeWrite:()=>rpc('fixture.flush')});
 api.hook=result;return <output aria-label="resources">{JSON.stringify({loading:result.loading,busy:result.busy,error:result.error,resources:result.resources})}</output>;
}
function Fixture(){const [mode,setMode]=useState('creation'),[account,setAccount]=useState(owner),[epoch,setEpoch]=useState(0);api={...api,owner,other,creationId,agentId,requestId,configure:(next:string)=>{reset();setMode(next);setAccount(owner);setEpoch(n=>n+1);},switch:()=>setAccount(other),calls:()=>calls,scope:()=>scope,plugins:()=>plugins,skills:()=>skills,fail:(value:string)=>fail=value,delay:(value:string)=>delay=value,release:()=>release?.(),read:readBuilderResources,apply:applyBuilderResources};Object.assign(window,{fixture:api});return <Hook key={epoch} mode={mode} account={account}/>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
