const {app}=require('electron'),fs=require('original-fs'),path=require('node:path'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'intent.json'),'utf8')),canonical=value=>path.win32.normalize(value).toLowerCase();
app.setPath('userData',path.join(__dirname,'helper-profile'));global.fetch=async()=>{throw Error('No network during full-profile backup');};
const hashFile=async file=>{const h=createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');};
const list=()=>execFileSync('wsl.exe',['--list','--running','--quiet'],{windowsHide:true,encoding:'buffer'}).toString('utf16le').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).sort();
const closed=()=>assert.equal(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count'],{encoding:'utf8',windowsHide:true}).trim(),'0','Close Agentopia normally before taking its profile snapshot.');
async function inventory(directory){
 const result={};
 async function walk(folder){
  assert.equal(canonical(fs.realpathSync.native(folder)),canonical(folder),'A profile folder resolves outside its expected location.');
  for(const name of await fs.promises.readdir(folder)){
   const file=path.join(folder,name),entry=await fs.promises.lstat(file);assert(!entry.isSymbolicLink(),'A linked profile entry needs explicit inspection.');
   if(entry.isDirectory())await walk(file);
   else{assert(entry.isFile(),'An unsupported profile entry needs inspection.');assert.equal(canonical(fs.realpathSync.native(file)),canonical(file));const relative=path.relative(directory,file).replaceAll('\\','/');assert(relative&&!relative.startsWith('../')&&!path.isAbsolute(relative));result[relative]={bytes:entry.size,sha256:await hashFile(file)};}
  }
 }
 await walk(directory);return Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
}
app.whenReady().then(async()=>{
 const evidence={...cfg,checks:[],canonicalProfileWrites:0,providerRequests:0,success:false};
 try{
  closed();assert.equal(canonical(fs.realpathSync.native(cfg.profile)),canonical(cfg.profile));assert(!canonical(cfg.profile).includes('\\packages\\'));
  const runningBefore=list();assert(!runningBefore.includes(cfg.expectedDistribution)&&!runningBefore.includes('AgentopiaRuntime'),'The app-bound and retained original runtimes must be stopped.');
  const binding=JSON.parse(await fs.promises.readFile(path.join(cfg.profile,'runtime-binding.json'),'utf8'));assert.equal(binding.distribution,cfg.expectedDistribution);
  evidence.runningBefore=runningBefore;evidence.checks.push('The installed application has exited and its bound runtime is stopped.');
  const backup=path.join(cfg.profile,'backups',cfg.backupName),manifest=JSON.parse(await fs.promises.readFile(path.join(backup,'manifest.json'),'utf8'));assert.equal(manifest.format,1);assert(Array.isArray(manifest.files));
  for(const item of manifest.files){assert.equal(path.basename(item.name),item.name);assert.equal(await hashFile(path.join(backup,item.name)),item.sha256);}
  for(const name of ['auth.dump','application.dump','vault.dump','database.dump','pgsodium_root.key'])assert(manifest.files.some(file=>file.name===name),'Missing database recovery file: '+name);
  evidence.databaseBackup=backup;evidence.databaseBackupFiles=manifest.files.map(({name,sha256})=>({name,sha256}));evidence.checks.push('All application-created database and encryption backup files match their manifest.');
  const source=await inventory(cfg.profile);for(const required of ['Local State','credentials.bin','runtime-binding.json'])assert(source[required]);closed();assert.deepEqual(list(),runningBefore);
  const destination=path.join(__dirname,'profile');assert(!fs.existsSync(destination));await fs.promises.mkdir(destination);
  for(const [relative,entry]of Object.entries(source)){
   const from=path.join(cfg.profile,relative),to=path.join(destination,relative);assert(canonical(to).startsWith(canonical(destination)+path.sep));
   await fs.promises.mkdir(path.dirname(to),{recursive:true});await fs.promises.copyFile(from,to);assert.equal(await hashFile(to),entry.sha256,'Copied profile bytes differ.');
  }
  const copied=await inventory(destination),after=await inventory(cfg.profile);assert.deepEqual(copied,source);assert.deepEqual(after,source);closed();assert.deepEqual(list(),runningBefore);
  evidence.files=Object.keys(source).length;evidence.bytes=Object.values(source).reduce((sum,item)=>sum+item.bytes,0);evidence.profileCopy=destination;evidence.profileFingerprint=createHash('sha256').update(JSON.stringify(source)).digest('hex');
  await fs.promises.writeFile(path.join(__dirname,'private-file-manifest.json'),JSON.stringify(source,null,2),{flag:'wx'});
  evidence.checks.push('Every original profile file is copied and hashed, including encrypted settings, browser state, drafts and native session files.');
  evidence.checks.push('The complete source profile is unchanged after copying and the app and bound runtime remain stopped.');evidence.success=true;
 }catch(error){evidence.error=error.message;}
 await fs.promises.writeFile(path.join(__dirname,'evidence.json'),JSON.stringify(evidence,null,2),{flag:'wx'});
 console.log(JSON.stringify({success:evidence.success,checks:evidence.checks,files:evidence.files,bytes:evidence.bytes,error:evidence.error,out:__dirname,canonicalProfileWrites:0,providerRequests:0},null,2));app.exit(evidence.success?0:1);
});
