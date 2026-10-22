export type DisplayState={context?:'open'|'closed';agents?:'open'|'closed';projects?:'open'|'closed';modes?:{defaultMode:'chatgpt'|'codex';projects:Record<string,'chatgpt'|'codex'>;chats:Record<string,'chatgpt'|'codex'>};completed?:string[];scheduled?:string;projectFolders?:Record<string,boolean>};
export type DisplaySnapshot=Record<string,DisplayState>;
export type DisplayDelivery={owner:string;id:string;state:DisplayState};
export const displayUuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fields=['context','agents','projects','modes','completed','scheduled','projectFolders'] as const;
function object(value:unknown):asserts value is Record<string,any>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid display preferences.');}
export function cleanDisplayState(value:unknown):DisplayState{
 object(value);if(Object.keys(value).some(key=>!fields.includes(key as any)))throw Error('Unknown display preference.');const result:DisplayState={};
 for(const key of ['context','agents','projects'] as const)if(value[key]!==undefined){if(!['open','closed'].includes(value[key]))throw Error('Invalid sidebar preference.');result[key]=value[key];}
 if(value.modes!==undefined){const modes=value.modes;object(modes);if(Object.keys(modes).some(key=>!['defaultMode','projects','chats'].includes(key))||!['chatgpt','codex'].includes(modes.defaultMode))throw Error('Invalid workspace mode.');const clean=(raw:unknown)=>{object(raw);if(Object.keys(raw).length>1000||Object.entries(raw).some(([id,mode])=>!displayUuid.test(id)||!['chatgpt','codex'].includes(mode)))throw Error('Invalid saved workspace modes.');return structuredClone(raw);};result.modes={defaultMode:modes.defaultMode,projects:clean(modes.projects),chats:clean(modes.chats)};}
 if(value.completed!==undefined){if(!Array.isArray(value.completed)||value.completed.length>500||value.completed.some((id:unknown)=>typeof id!=='string'||!displayUuid.test(id)))throw Error('Invalid saved chat indicators.');result.completed=[...new Set<string>(value.completed)];}
 if(value.scheduled!==undefined){if(typeof value.scheduled!=='string'||!displayUuid.test(value.scheduled))throw Error('Invalid selected scheduled task.');result.scheduled=value.scheduled;}
 if(value.projectFolders!==undefined){object(value.projectFolders);if(Object.keys(value.projectFolders).length>1000||Object.entries(value.projectFolders).some(([id,open])=>!displayUuid.test(id)||typeof open!=='boolean'))throw Error('Invalid project folder preferences.');result.projectFolders=structuredClone(value.projectFolders);}
 return result;
}
export function cleanDisplaySnapshot(value:unknown):DisplaySnapshot{object(value);if(Object.keys(value).length>10000||JSON.stringify(value).length>4*1024**2)throw Error('Display preferences exceed the backup limit.');const result:DisplaySnapshot={};for(const [owner,state]of Object.entries(value)){if(!displayUuid.test(owner))throw Error('Invalid display account.');result[owner]=cleanDisplayState(state);}return result;}
export function displayStorageKeys(owner:string){return {context:'agentopia.chat-context.'+owner,agents:'agentopia.sidebar.'+owner+'.Your agents',projects:'agentopia.sidebar.'+owner+'.Projects',modes:'agentopia.workspace-modes.'+owner,completed:'agentopia.completed-chats:'+owner,scheduled:'agentopia.schedule.'+owner+'.selected',projectFolders:'agentopia.project-folders.'+owner};}
type StorageRead=Pick<Storage,'length'|'key'|'getItem'>;
export function collectDisplaySnapshot(storage:StorageRead):DisplaySnapshot{
 const owners=new Set<string>();for(let i=0;i<storage.length;i++){const key=storage.key(i)??'',match=/^agentopia\.(?:chat-context\.|sidebar\.|workspace-modes\.|completed-chats:|schedule\.|project-folders\.)([a-f0-9-]{36})(?:$|\.)/i.exec(key);if(match&&displayUuid.test(match[1]))owners.add(match[1]);}
 const result:DisplaySnapshot={};for(const owner of owners){const state:Record<string,unknown>={};for(const [name,key]of Object.entries(displayStorageKeys(owner))){const value=storage.getItem(key);if(value===null)continue;state[name]=['modes','completed','projectFolders'].includes(name)?JSON.parse(value):value;}if(Object.keys(state).length)result[owner]=cleanDisplayState(state);}return cleanDisplaySnapshot(result);
}
export function restoreDisplayDelivery(owner:string,delivery:DisplayDelivery|undefined,storage:Pick<Storage,'getItem'|'setItem'>){
 if(!delivery)return;if(!displayUuid.test(owner)||delivery.owner!==owner||!/^[a-f0-9]{64}$/.test(delivery.id))throw Error('These display preferences belong to another recovery account.');const state=cleanDisplayState(delivery.state),marker='agentopia.display-recovery.'+owner;if(storage.getItem(marker)===delivery.id)return;
 const keys=displayStorageKeys(owner),entries=Object.entries(state).map(([name,value])=>[keys[name as keyof typeof keys],typeof value==='string'?value:JSON.stringify(value)] as const);
 for(const [key,value]of entries){const current=storage.getItem(key);if(current!==null&&current!==value)throw Error('Existing display preferences conflict with recovery. Preserve the current profile before continuing.');}
 for(const [key,value]of entries)storage.setItem(key,value);storage.setItem(marker,delivery.id);
}
