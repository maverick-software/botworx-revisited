import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,cp,copyFile,readFile,writeFile,readdir,symlink} from 'node:fs/promises';
import {build} from 'vite';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json} from './phased-backup-control.mjs';

desktopOperation('build the focused reference typography127 interface');
const root=path.resolve(import.meta.dirname,'../..'),sourceBase=(await json(path.join(root,'.supabase/desktop-visible126/installed-current.json'))).proof,previousCandidate=(await json(path.join(root,'.supabase/desktop-computer-repair76/installed-current.json'))).proof,base=await json(sourceBase),delivered=await json(previousCandidate),out=path.join(root,'.supabase/desktop-typography127','candidate-'+Date.now()),source=path.join(out,'source/desktop');
assert(base.success);assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.75/resources/app.asar'),base.imageSha256);await mkdir(source,{recursive:true});
for(const name of['ui','src'])await cp(path.join(base.source,name),path.join(source,name),{recursive:true,errorOnExist:true});
for(const name of['package.json','vite.config.mjs','presentation-renderer-patch.mjs'])await copyFile(path.join(base.source,name),path.join(source,name));
await symlink(path.join(root,'node_modules'),path.join(out,'source/node_modules'),'junction');
const original=await readFile(path.join(source,'ui/style.css'),'utf8');
let css=original;
for(const [from,to] of [
 ["font-family:'Segoe UI Variable','Segoe UI',Arial,sans-serif","font-family:'Segoe UI',Arial,sans-serif"],
 ['--bg:#191b1d;--sidebar:#1b2023;--surface:#292e32;--soft:#30363b;--hover:#292f34;--selected:#32393f;--text:#ececec;--muted:#adb4ba;--border:#353b40','--bg:#181818;--sidebar:#181818;--surface:#212121;--soft:#303030;--hover:#292929;--selected:#303030;--text:#fff;--muted:#a3a3a3;--work-status:#8b8b8b;--border:#2f2f2f'],
 ['--desktop-chrome:#1c2429;--desktop-edge:#30383e','--desktop-chrome:#181818;--desktop-edge:#303030'],
 ['color:var(--muted);font-size:12px;font-weight:450;border-radius:4px','color:var(--work-status,var(--muted));font-size:13px;font-weight:500;border-radius:4px'],
 ['min-height:28px;font-size:12px}\n','min-height:28px;font-size:13px}\n'],
 ['.native-message-phase.commentary{color:var(--muted);font-size:13px}', '.native-message-phase.commentary{color:var(--text);font-size:var(--message-size)}'],
 ['.native-item summary{display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;', '.native-item summary{display:flex;align-items:center;gap:7px;cursor:pointer;color:var(--muted);font-size:13px;'],
 ['.sidebar-section-toggle{flex:1;min-width:0;min-height:30px;justify-content:flex-start;gap:5px;padding:5px 0;background:none;color:var(--muted);font-size:12px;font-weight:500;', '.sidebar-section-toggle{flex:1;min-width:0;min-height:30px;justify-content:flex-start;gap:5px;padding:5px 0;background:none;color:var(--muted);font-size:13px;font-weight:500;']
]){const anchor=from.replaceAll('\n','\r\n');const match=css.includes(from)?from:anchor;assert.equal(css.split(match).length,2,'Expected one style anchor: '+from.slice(0,70));css=css.replace(match,to.replaceAll('\n',match.includes('\r\n')?'\r\n':'\n'));}
const currentStyle=await readFile(path.join(root,'desktop/ui/style.css'),'utf8');assert(currentStyle===original||currentStyle===css||currentStyle===await readFile(path.join(delivered.source,'ui/style.css'),'utf8'),'Review divergent development styles before delivery.');await writeFile(path.join(source,'ui/style.css'),css);await writeFile(path.join(root,'desktop/ui/style.css'),css);
const ui=path.join(out,'resources/ui');await build({configFile:path.join(source,'vite.config.mjs'),logLevel:'error',build:{outDir:ui}});
const uiFiles={};for(const entry of await readdir(ui,{recursive:true,withFileTypes:true})){assert(!entry.isSymbolicLink());if(entry.isFile()){const file=path.join(entry.parentPath,entry.name);uiFiles[path.relative(ui,file).replaceAll('\\','/')]=await hash(file);}}
const proof={...base,out,source,previousCandidate,baseImageSha256:base.imageSha256,ui,uiFiles,sourceHashes:{...base.sourceHashes,'ui/style.css':await hash(path.join(source,'ui/style.css'))},revision:'reference-typography127',uiOnly:true,changedCompiled:[],installed:false,providerRequests:0,fullGoalComplete:false,unchangedNativeEvidence:(await json(path.join(root,'.supabase/desktop-visible126/native-current.json'))).evidence,controllerSha256:await hash(import.meta.filename),reference:{image:'codex-clipboard-19f3da51-c027-40fe-a3b0-9513c9768964.png',background:'#181818',body:'Segoe UI 14px / 23.1px',metadata:'13px; work status #8b8b8b, tool labels #a3a3a3',limitation:'Screenshot reference; exact reference application CSS and zoom were not supplied.'}};
await writeFile(path.join(out,'proof.json'),JSON.stringify(proof,null,2));await writeFile(path.join(root,'.supabase/desktop-typography127/current.json'),JSON.stringify({proof:path.join(out,'proof.json')},null,2));console.log(JSON.stringify({success:true,out,revision:proof.revision,backendUnchanged:true}));
