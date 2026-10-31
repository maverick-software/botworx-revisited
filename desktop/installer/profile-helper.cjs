const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {migratedDesktopProfile}=require('./profile-validator.cjs');
const {execFileSync}=require('node:child_process');
const equal=(a,b)=>path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
function exists(file){try{fs.lstatSync(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
function plainFile(file,max=8192){const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>max||!equal(fs.realpathSync.native(file),file))throw Error('An installation record is linked or invalid.');return fs.readFileSync(file,'utf8');}
function assertNotRunning(destination,isolated){
 const env={...process.env};for(const key of Object.keys(env))if(key.toLowerCase()==='psmodulepath')delete env[key];
 const text=execFileSync(path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';ConvertTo-Json -InputObject @(Get-Process -Name Sylvana -ErrorAction SilentlyContinue | ForEach-Object { if($_.Path){$_.Path}else{'unavailable'} }) -Compress"],{env,windowsHide:true,encoding:'utf8',timeout:30000});
 const processes=JSON.parse(text.replace(/^\uFEFF/,''));
 if(processes.some(exe=>!isolated||exe==='unavailable'||equal(path.dirname(exe),destination)))throw Error('Close Sylvana normally before installing or uninstalling. Setup will not force-close it.');
}
function prepare({home,appData,destination,installed=false}){
 home=fs.realpathSync.native(home);destination=path.resolve(destination);
 if(!/^[a-z]:\\/i.test(destination)||destination.length<8||path.parse(destination).root===destination)throw Error('Choose a dedicated folder on a local drive.');
 let ancestor=destination;while(!exists(ancestor))ancestor=path.dirname(ancestor);
 if(!equal(fs.realpathSync.native(ancestor),ancestor))throw Error('The destination passes through a linked folder. Choose its physical location.');
 const directory=path.join(home,'.sylvana','desktop'),location=path.join(directory,'profile-location.json'),registration=path.join(directory,'wizard-installation.json');
 if(exists(path.join(directory,'migration.lock')))throw Error('A profile migration is active. Finish it before installing.');
 const record={format:1,kind:'sylvana-wizard-installation',installationRoot:destination,home,profile:path.join(home,'AppData','Roaming','Sylvana')};
 if(exists(location)){
  const text=plainFile(location,4096),value=JSON.parse(text);
  if(typeof value.installationRoot!=='string'||!equal(value.installationRoot,path.join(home,'AppData','Local','SylvanaDesktop')))throw Error('The existing installation record belongs to another Windows user or installation.');
  const profile=migratedDesktopProfile(path.join(value.installationRoot,'app-0.0.0','Sylvana.exe'),home);
  if(!profile)throw Error('The existing profile could not be verified.');
  Object.assign(record,{profile,legacyInstallationRoot:value.installationRoot,profileLocationSha256:createHash('sha256').update(text).digest('hex')});
 }else{
  if(!equal(appData,path.join(home,'AppData','Roaming')))throw Error('This redirected Windows profile needs a verified migration before setup.');
  if(exists(path.join(home,'.agentopia','desktop','profile-location.json')))throw Error('Complete the existing Sylvana data migration before installing.');
 }
 let previous;
 if(exists(registration)){
  previous=JSON.parse(plainFile(registration));
  if(previous.format!==1||previous.kind!=='sylvana-wizard-installation'||typeof previous.home!=='string'||!equal(previous.home,home))throw Error('Restore the existing installation record before continuing.');
  if(previous.legacyInstallationRoot&&!record.legacyInstallationRoot)throw Error('The existing migrated data selection is missing. Restore it before reinstalling.');
  if(!record.legacyInstallationRoot&&(typeof previous.profile!=='string'||!equal(previous.profile,record.profile)))throw Error('The existing personal data location changed. Restore its verified selection before continuing.');
 }
 for(const forbidden of [home,appData,record.profile,path.join(home,'.sylvana')]){
  const relative=path.relative(destination,forbidden),inverse=path.relative(forbidden,destination);
  if(!relative||!inverse||!relative.startsWith('..')&&!path.isAbsolute(relative)||!inverse.startsWith('..')&&!path.isAbsolute(inverse)){
   // Program folders inside the user's home are expected; profile and AppData
   // roots themselves and all private-data descendants are never destinations.
   if(equal(forbidden,home)&&!equal(home,destination)&&inverse&&!inverse.startsWith('..'))continue;
   if(equal(forbidden,appData)&&inverse&&!inverse.startsWith('..')&&!equal(destination,appData))continue;
   throw Error('The program folder overlaps existing personal data. Choose a separate folder.');
  }
 }
 if(exists(destination)){
  if(!fs.lstatSync(destination).isDirectory()||!equal(fs.realpathSync.native(destination),destination))throw Error('The destination is linked or is not a folder.');
  const files=fs.readdirSync(destination);
  if(files.length&&!installed){
   if(!exists(registration))throw Error('Choose an empty folder for the first wizard installation.');
   if(!previous)throw Error('The destination belongs to another installation.');
   if(previous.format!==1||previous.kind!=='sylvana-wizard-installation'||!equal(previous.home,home)||!equal(previous.installationRoot,destination))throw Error('The destination belongs to another installation.');
  }
 }
 return record;
}
function commit(options,prepared){
 const record=prepare({...options,installed:true});if(JSON.stringify(record)!==JSON.stringify(prepared))throw Error('The data selection changed while setup was running.');
 if(!exists(path.join(record.installationRoot,'Sylvana.exe')))throw Error('The application was not extracted.');
 const directory=path.join(record.home,'.sylvana','desktop');
 fs.mkdirSync(directory,{recursive:true});if(!equal(fs.realpathSync.native(directory),directory))throw Error('The installation record directory is linked.');
 const target=path.join(directory,'wizard-installation.json'),temporary=target+'.'+process.pid+'.tmp';
 if(exists(target))fs.copyFileSync(target,path.join(options.receiptDirectory,'previous-wizard-installation.json'),fs.constants.COPYFILE_EXCL);
 fs.writeFileSync(temporary,JSON.stringify(record,null,2)+'\n',{flag:'wx'});fs.renameSync(temporary,target);
 return record;
}
function retireLegacy(record,isolated){
 if(isolated||!record.legacyInstallationRoot)return;
 const key='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SylvanaDesktop',reg=path.join(process.env.SystemRoot,'System32','reg.exe');
 let info;try{info=execFileSync(reg,['query',key,'/v','InstallLocation'],{encoding:'utf8',windowsHide:true});}catch(error){if(error.status===1)return;throw error;}
 const location=info.match(/InstallLocation\s+REG_SZ\s+(.+)/)?.[1]?.trim();
 if(!location||!equal(location,record.legacyInstallationRoot))throw Error('The previous uninstall registration belongs to another installation.');
 const backup=path.join(record.home,'.sylvana/desktop/squirrel-uninstall-backup.reg');
 if(!exists(backup))execFileSync(reg,['export',key,backup],{windowsHide:true,stdio:'pipe'});
 execFileSync(reg,['delete',key,'/f'],{windowsHide:true,stdio:'pipe'});
}
module.exports={prepare,commit};
if(require.main===module){
 try{
  const [action,home,appData,destination,receiptDirectory,mode]=process.argv.slice(2),options={home,appData,destination,receiptDirectory},receipt=path.join(receiptDirectory,'wizard-prepared.json');
  if(action==='prepare'){assertNotRunning(destination,mode==='isolated');fs.writeFileSync(receipt,JSON.stringify(prepare(options)),{flag:'w'});}
  else if(action==='commit')retireLegacy(commit(options,JSON.parse(fs.readFileSync(receipt,'utf8'))),mode==='isolated');
  else if(action==='check-running')assertNotRunning(destination,mode==='isolated');
  else throw Error('Unsupported setup operation.');
  console.log('Existing data selection verified.');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
