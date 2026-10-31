import {readFileSync,lstatSync,existsSync,realpathSync} from 'node:fs';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';import path from 'node:path';
import manifest from './script-runtime-manifest.json';
import codeTools from './code-tool-manifest.json';
import artifacts from './artifact-runtime-manifest.json';
import {commandEnvironment} from './execution-environment';
const verified=new Set<string>(),preparing=new Map<string,Promise<void>>();
const entries:[string,string][]=[...Object.entries(manifest.files).map(([name,digest])=>['script-runtimes/'+name,digest] as [string,string]),...Object.entries(codeTools.files),...Object.entries(artifacts.files).map(([name,digest])=>[artifacts.directory+'/'+name,digest] as [string,string])];
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
function available(resources:string){return existsSync(path.join(resources,'script-runtimes'))||existsSync(path.join(resources,'version.json'));}
function checkedPath(root:string,name:string){const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw new Error('Invalid bundled command tool path.');return file;}
const changed=(name:string)=>new Error('The bundled command tool is missing or changed. Repair Sylvana before running commands: '+name);
export function verifyScriptRuntimes(resources:string){
 const root=path.resolve(resources);if(verified.has(root))return;const actualRoot=realpathSync(root);
 for(const name of ['script-runtimes','code-tools',artifacts.directory])if(lstatSync(path.join(root,name)).isSymbolicLink())throw changed(name);
 for(const [name,digest] of entries){const file=checkedPath(root,name),stat=lstatSync(file),actual=realpathSync(file);if(!stat.isFile()||stat.isSymbolicLink()||!actual.startsWith(actualRoot+path.sep)||hash(readFileSync(file))!==digest)throw changed(name);}
 verified.add(root);
}
async function verifyAsync(root:string){
 const actualRoot=await realpath(root);for(const name of ['script-runtimes','code-tools',artifacts.directory])if((await lstat(path.join(root,name))).isSymbolicLink())throw changed(name);
 let index=0;await Promise.all(Array.from({length:8},async()=>{while(index<entries.length){const [name,digest]=entries[index++],file=checkedPath(root,name),stat=await lstat(file),actual=await realpath(file);if(!stat.isFile()||stat.isSymbolicLink()||!actual.startsWith(actualRoot+path.sep)||hash(await readFile(file))!==digest)throw changed(name);}}));verified.add(root);
}
export async function prepareScriptRuntimes(resources:string,signal?:AbortSignal){
 signal?.throwIfAborted();const root=path.resolve(resources);if(!available(root)||verified.has(root))return;
 let pending=preparing.get(root);if(!pending){pending=verifyAsync(root);preparing.set(root,pending);void pending.finally(()=>preparing.delete(root)).catch(()=>{});}
 if(!signal)return pending;
 await new Promise<void>((resolve,reject)=>{const abort=()=>{cleanup();reject(signal.reason);},cleanup=()=>signal.removeEventListener('abort',abort);signal.addEventListener('abort',abort,{once:true});pending!.then(()=>{cleanup();resolve();},error=>{cleanup();reject(error);});if(signal.aborted)abort();});signal.throwIfAborted();
}
export function scriptEnvironment(resources:string,source:NodeJS.ProcessEnv=process.env){
 const env=commandEnvironment(source),root=path.resolve(resources),directory=path.join(root,'script-runtimes');
 // Unit fixtures can provide only the PowerShell supervisor. Packaged resources
 // include version.json and must never silently rely on external developer tools.
 if(!available(root))return env;verifyScriptRuntimes(root);
 // Match Windows child-process key ordering if a caller supplies both forms.
 const keys=Object.keys(env).filter(key=>key.toLowerCase()==='path').sort(),inherited=keys.length?env[keys[0]]:undefined;for(const key of keys)delete env[key];
 env.PATH=[path.join(directory,manifest.node.directory),path.join(directory,manifest.python.directory),path.join(directory,manifest.python.directory,'Scripts'),path.join(root,codeTools.git.directory),path.join(root,codeTools.ripgrep.directory),path.join(root,codeTools.powershell.directory),inherited].filter(Boolean).join(path.delimiter);
 env.POWERSHELL_TELEMETRY_OPTOUT='1';env.POWERSHELL_DIAGNOSTICS_OPTOUT='1';env.POWERSHELL_UPDATECHECK='Off';
 env.PYTHONNOUSERSITE='1';env.PYTHONUTF8='1';env.PYTHONDONTWRITEBYTECODE='1';
 env.PYTHONPATH=path.join(root,artifacts.directory,'bootstrap');
 env.PIP_REQUIRE_VIRTUALENV='true';env.PIP_CONFIG_FILE=process.platform==='win32'?'NUL':'/dev/null';env.PIP_DISABLE_PIP_VERSION_CHECK='1';
 env.NPM_CONFIG_USERCONFIG=path.join(directory,'npm-user.npmrc');env.NPM_CONFIG_GLOBALCONFIG=path.join(directory,'npm-global.npmrc');env.NPM_CONFIG_UPDATE_NOTIFIER='false';
 return env;
}
export function prepareCommandRuntimes(script:string,signal?:AbortSignal){return prepareScriptRuntimes(path.resolve(path.dirname(script),'..'),signal);}
export function commandScriptEnvironment(script:string,source:NodeJS.ProcessEnv=process.env){return scriptEnvironment(path.resolve(path.dirname(script),'..'),source);}
export function commandShellForScript(script:string){const root=path.resolve(path.dirname(script),'..');return available(root)?path.join(root,codeTools.powershell.directory,codeTools.powershell.entry):path.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');}
export function scriptRuntimeStatus(){return {node:manifest.node.version,python:manifest.python.version,npm:true,venv:true,powershell:codeTools.powershell.version,git:codeTools.git.version,ripgrep:codeTools.ripgrep.version,artifactLibraries:Object.fromEntries(artifacts.wheels.map(wheel=>[wheel.name,wheel.version]))};}
export const scriptRuntimeInstructions='Sylvana bundles Node.js '+manifest.node.version+' (node, npm, npx), Python '+manifest.python.version+' (python), Git '+codeTools.git.version+' (git), ripgrep '+codeTools.ripgrep.version+' (rg), and PowerShell '+codeTools.powershell.version+' (pwsh). Use pwsh for UTF-8 script files. Use the native apply_patch tool API directly when available. On Windows, apply_patch is not a PowerShell command; never pipe patch text to a shell command named apply_patch. If the native patch tool is unavailable, use Sylvana write_file or UTF-8 PowerShell file operations within the authorized workspace. These commands are on PATH in managed and native shell sessions, including children. Use a project-local Python virtual environment (python -m venv .venv), then .venv\\Scripts\\python.exe -m pip for dependencies. Keep JavaScript dependencies local to the project. Do not modify the bundled tools or machine-wide settings. Bundled Python also provides python-docx (docx), openpyxl, XlsxWriter (xlsxwriter), python-pptx (pptx), ReportLab (reportlab), pypdf and Pillow (PIL) for Word documents, spreadsheets, presentations, PDFs and image processing. These libraries are available offline in normal managed/native Python sessions; project virtual-environment dependencies take precedence. Save generated files in the authorized workspace and provide their actual paths. Spreadsheet libraries do not recalculate formulas; validate computed results or provide accurate cached values where supported. Read real output and exit status before claiming success. When editing an existing Office file, inspect its saved ZIP package and relationships before choosing a sheet or slide. XML prefixes are arbitrary: match namespace URIs and element names, never assume literal <t>, <a:t> or any particular prefix. For a minimal text edit, locate the exact parsed element and preserve its actual serialized prefix or serialize only that affected part with a namespace-aware library; escape replacement text and verify the parsed result. Keep unrelated ZIP parts byte-identical where possible, including styles, relationships, geometry, notes, formulas and saved formula caches. Saving an existing workbook through openpyxl can discard cached formula values, and python-pptx can rename slide parts in memory; use the original package relationships for saved slide order and compare the untouched contents independently. Verify the final files reopen, the requested values changed, and the required surrounding content stayed intact before reporting success.';
