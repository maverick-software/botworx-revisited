import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const edit=async(file,fn)=>{const original=await readFile(file,'utf8');await writeFile(file,fn(original));};
const replace=(s,a,b)=>{assert(s.includes(a),'Missing source: '+a.slice(0,100));return s.replace(a,b);};
await edit('desktop/ui/PluginManager.tsx',s=>{
 s=replace(s,"import {Plug,ShieldCheck,Search,Plus,RefreshCw,Settings,Trash2}","import {Plug,ShieldCheck,Search,Plus,RefreshCw,Settings,Trash2,ChevronDown,ChevronRight,MoreHorizontal,BookOpen,Image,Globe}");
 const start=s.indexOf('const title='),end=s.indexOf('\nexport default',start);s=s.slice(0,start)+"import {pluginTitle as title} from './plugin-presentation';\nimport {ComposioConnectionCard} from './ComposioConnectionCard';\nimport './plugin-catalog.css';"+s.slice(end);
 s=replace(s,'export default function PluginManager({agents,admin,edit}:{agents:Agent[];admin:boolean;edit:(agent:Agent)=>void}){','export default function PluginManager({agents,admin,edit,selection,select,composio,settings,changed}:{agents:Agent[];admin:boolean;edit:(agent:Agent)=>void;selection?:string|null;select?:(name:string|null)=>void;composio?:()=>void;settings?:()=>void;changed?:()=>void}){');
 s=replace(s,'[selected,setSelected]=useState<string|null>(null)','[localSelected,setLocalSelected]=useState<string|null>(null)');
 s=replace(s,",[inventories,setInventories]=useState<Record<string,any>>({})",'');
 s=replace(s," const refresh=useCallback(async()=>setRows(await call<PluginRecord[]>('plugins.list')),[]);"," const selected=select?selection:localSelected,setSelected=select??setLocalSelected;\n const [tab,setTab]=useState<'public'|'personal'>('public');\n const refresh=useCallback(async()=>{setRows(await call<PluginRecord[]>('plugins.list'));changed?.();},[changed]);");
 const a=s.indexOf(' return <div className="plugin-manager">'),b=s.indexOf('\n {plugin&&',a);assert(a>0&&b>a);
 s=s.slice(0,a)+` const manage=(row:PluginRecord)=>{setSelected(row.name);setKey('');setError('');setNotice('');};
 const groups=tab==='personal'?[{name:'Personal plugins',rows:display.filter(row=>!row.bundled)}]:[{name:'Search & research',rows:display.filter(row=>row.bundled&&(row.kind==='search'||row.kind==='mcp'))},{name:'Create & work',rows:display.filter(row=>row.bundled&&(row.kind==='images'||row.kind==='skills'))}];
 const showComposio=!!composio&&tab==='public'&&('composio app connections oauth api'.includes(query.toLowerCase()));
 return <div className="plugin-manager plugin-catalog"><div className="plugin-catalog-header"><div><h1>Plugins</h1><p>Connect plugins to let your agents work across your apps</p></div><div className="plugin-catalog-controls"><label className="plugin-filter"><Search size={16}/><input aria-label="Search plugins" placeholder="Search plugins" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="icon-button" aria-label="Refresh plugins" title="Refresh plugins" disabled={busy} onClick={()=>void operate(refresh)}><RefreshCw size={16}/></button>{settings&&<button className="icon-button" aria-label="Plugin settings" title="Plugin settings" onClick={settings}><Settings size={16}/></button>}<button className="plugin-catalog-add" disabled={busy} onClick={beginImport}>Add<ChevronDown size={14}/></button></div></div><div className="plugin-catalog-tabs" role="tablist" aria-label="Plugin catalog"><button role="tab" aria-selected={tab==='public'} onClick={()=>setTab('public')}>Public</button><button role="tab" aria-selected={tab==='personal'} onClick={()=>setTab('personal')}>Personal</button></div>{error&&<p role="alert" className="danger">{error}</p>}{notice&&<p role="status">{notice}</p>}{showComposio&&<section className="plugin-catalog-section"><h2>App connections<ChevronRight size={15}/></h2><div className="plugin-catalog-rows"><ComposioConnectionCard compact open={composio!}/></div></section>}{groups.filter(group=>group.rows.length).map(group=><section className="plugin-catalog-section" key={group.name}><h2>{group.name}<ChevronRight size={15}/></h2><div className="plugin-catalog-rows">{group.rows.map(row=><article className="plugin-catalog-row" key={row.name}><span className="plugin-catalog-logo">{row.kind==='skills'?<BookOpen/>:row.kind==='images'?<Image/>:row.kind==='search'?<Globe/>:<Plug/>}</span><button className="plugin-catalog-info" onClick={()=>manage(row)} title={row.description}><strong>{title(row)}</strong><small>{row.description}</small></button><button className="icon-button" aria-label={'Manage plugin '+row.name} title={'Manage '+title(row)} onClick={()=>manage(row)}><MoreHorizontal size={18}/></button></article>)}</div></section>)}{!showComposio&&!groups.some(group=>group.rows.length)&&<p className="plugin-catalog-empty">{query?'No matching plugins.':tab==='personal'?'Your imported plugins will appear here. Choose Add to install a plugin.':'No public plugins are available.'}</p>}
`+s.slice(b);
 // Raw tool schemas and discovery now live on Tools, while plugin assignment stays here.
 const x=s.indexOf('{grant?.connection_ids.map('),y=s.indexOf('</div>;})}',x);assert(x>0&&y>x);s=s.slice(0,x)+s.slice(y);
 s=s.replaceAll('setInventories({});','');
 return s;
});
await edit('desktop/ui/ComposioConnectionCard.tsx',s=>{
 s=replace(s,'{open}:{open:()=>void}','{open,compact=false}:{open:()=>void;compact?:boolean}');
 s=replace(s,' return <article',` if(compact)return <article className="plugin-catalog-row" aria-label="Composio connection"><span className="plugin-catalog-logo"><Plug size={23}/></span><button className="plugin-catalog-info" onClick={open}><strong>Composio</strong><small>{error?'Connection status unavailable':configured?connected+' connected apps · OAuth and API keys':'Connect apps with OAuth or API keys'}</small></button><button className="icon-button" aria-label={action+' Composio'} title={action+' Composio'} onClick={open}><ArrowRight size={18}/></button></article>;
 return <article`);return s;
});
await edit('desktop/ui/WorkspaceViews.tsx',s=>{
 s="import {CustomizeNavigation,isCustomize} from './CustomizeNavigation';\nimport './plugin-catalog.css';\n"+s;
 s=replace(s,"export type View='chat'|'agents'|'plugins'|'scheduled';","export type View='chat'|'agents'|'plugins'|'skills'|'tools'|'scheduled';");
 s=replace(s,"workspaceMode='chatgpt',selectWorkspaceMode=()=>{}}", "workspaceMode='chatgpt',selectWorkspaceMode=()=>{},pluginSelection,selectPlugin,pluginRevision}");
 s=replace(s,' workspaceMode?:WorkspaceMode;', ' pluginSelection?:string|null;selectPlugin?:(name:string|null)=>void;pluginRevision?:number;workspaceMode?:WorkspaceMode;');
 s=replace(s,'{scheduled?<ScheduledNavigation/>:<><div','{isCustomize(view)?<CustomizeNavigation view={view} open={openView} selection={pluginSelection} select={selectPlugin} revision={pluginRevision}/>:scheduled?<ScheduledNavigation/>:<><div');
 const a=s.indexOf('export function Plugins('),b=s.indexOf('export function ChatMenuItems',a);assert(a>0&&b>a);
 s=s.slice(0,a)+`export function Plugins({agents,edit,admin,selection,select,changed,settings}:{agents:Agent[];edit:(agent:Agent)=>void;admin:boolean;selection?:string|null;select?:(name:string|null)=>void;changed?:()=>void;settings?:()=>void}){const [showComposio,setShowComposio]=useState(false);if(showComposio)return <section className="library-page plugins-catalog-page"><ComposioPage agents={agents} back={()=>setShowComposio(false)}/></section>;return <section className="library-page plugins-catalog-page"><PluginManager agents={agents} admin={admin} edit={edit} selection={selection} select={select} changed={changed} settings={settings} composio={()=>setShowComposio(true)}/></section>;}

`+s.slice(b);return s;
});
await edit('desktop/ui/DesktopApp.tsx',s=>{
 s="import {ToolsPage,SkillsPage} from './CustomizePages';\n"+s;
 s=replace(s," const [view,setView]=useState<View>('chat')", " const [pluginSelection,setPluginSelection]=useState<string|null>(null),[pluginRevision,setPluginRevision]=useState(0);\n const [view,setView]=useState<View>('chat')");
 s=replace(s,"target==='/plugins'||target==='/scheduled'", "target==='/plugins'||target==='/tools'||target==='/skills'||target==='/scheduled'");
 s=replace(s,'setView(\'chat\');setActiveProject',"setPluginSelection(null);setView('chat');setActiveProject");
 s=replace(s,'<Sidebar workspaceMode=', '<Sidebar pluginSelection={pluginSelection} selectPlugin={setPluginSelection} pluginRevision={pluginRevision} workspaceMode=');
 s=replace(s,"view==='scheduled'?'Scheduled':'Plugins'", "view==='scheduled'?'Scheduled':view==='skills'?'Skills':view==='tools'?'Tools':'Plugins'");
 const old="    {view==='plugins'&&<Plugins admin={identity.admin} agents={agents} edit={agent=>setEditor({agent,section:'mcp'})} connection={connection} open={()=>setSettings('connections')} tools={()=>setSettings('tools')}/>}",context="{{agent:selected,options,change:changeOptions,disabled:handoff||loading,terminal:()=>pane.current?.terminal(),configure:()=>{if(selected)setEditor({agent:selected,section:'mcp'});}}}";
 s=replace(s,old,`    {view==='plugins'&&<Plugins key={identity.id} admin={identity.admin} agents={agents} edit={agent=>setEditor({agent,section:'mcp'})} selection={pluginSelection} select={setPluginSelection} changed={()=>setPluginRevision(n=>n+1)} settings={()=>setSettings('plugins')}/>}
    {view==='tools'&&<ToolsPage owner={identity.id} agents={agents} edit={agent=>setEditor({agent,section:'mcp'})} run={run} plugins={()=>openView('plugins')} context=${context}/>}
    {view==='skills'&&<SkillsPage context=${context}/>}`);return s;
});
await edit('desktop/ui/ProjectNavigation.tsx',s=>replace(s,"(view==='plugins'?'active':'')", "(['plugins','tools','skills'].includes(view)?'active':'')"));
await edit('desktop/src/contracts.ts',s=>replace(s,"view:'chat'|'agents'|'plugins'|'scheduled'", "view:'chat'|'agents'|'plugins'|'skills'|'tools'|'scheduled'"));
await edit('desktop/src/desktop-location.ts',s=>replace(s,"['chat','agents','plugins','scheduled']", "['chat','agents','plugins','skills','tools','scheduled']"));
await edit('desktop/src/startup-location.ts',s=>replace(s,"if(path==='/agents'||path==='/plugins'||path==='/scheduled')return {view:path.slice(1) as 'agents'|'plugins'|'scheduled'};", "if(['/agents','/plugins','/skills','/tools','/scheduled'].includes(path))return {view:path.slice(1) as DesktopLocation['view']};"));
console.log('Plugin browse layout and separate Customize pages applied.');
