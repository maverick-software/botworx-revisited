import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {migratedDesktopProfile,type ProfileLocationIO} from './desktop-profile-location';

const nativeIO:ProfileLocationIO={realpath:value=>realpathSync.native(value),inspect:value=>lstatSync(value),readFile:value=>readFileSync(value,'utf8')};
const equal=(a:string,b:string)=>path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
const fail=()=>new Error('Sylvana could not verify the setup wizard’s existing data selection. Reinstall to the registered location or restore the installation record. Your existing data has been preserved.');

// The installer registers a program location without rewriting the existing
// migration receipt, moving credentials, or changing the private runtime.
export function wizardDesktopProfile(exe:string,home:string|undefined,io:ProfileLocationIO=nativeIO):string|undefined{
 if(!home||!path.win32.isAbsolute(home)||home.startsWith('\\\\'))return;
 const directory=path.win32.join(io.realpath(home),'.sylvana','desktop'),file=path.win32.join(directory,'wizard-installation.json');
 const squirrel=/\\SylvanaDesktop\\app-\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?\\Sylvana\.exe$/i.test(exe);
 let info;try{info=io.inspect(file);}catch(error){
  if((error as NodeJS.ErrnoException).code!=='ENOENT')throw fail();
  if(!squirrel&&path.win32.basename(exe).toLowerCase()==='sylvana.exe'){
   try{io.inspect(path.win32.join(directory,'profile-location.json'));throw fail();}catch(missing){if((missing as NodeJS.ErrnoException).code!=='ENOENT')throw fail();}
  }
  return;
 }
 try{
  if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>8192||!equal(io.realpath(file),file))throw fail();
  const record=JSON.parse(io.readFile(file));
  if(record.format!==1||record.kind!=='sylvana-wizard-installation'||typeof record.installationRoot!=='string'||typeof record.home!=='string'||!equal(record.home,home)||!equal(io.realpath(directory),directory))throw fail();
  if(!equal(exe,path.win32.join(record.installationRoot,'Sylvana.exe'))){if(squirrel)return;throw fail();}
  if(!/^[a-z]:\\/i.test(record.installationRoot)||!equal(io.realpath(record.installationRoot),record.installationRoot))throw fail();
  try{io.inspect(path.win32.join(directory,'migration.lock'));throw fail();}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw fail();}
  if(record.legacyInstallationRoot!==undefined){
   if(typeof record.legacyInstallationRoot!=='string'||typeof record.profileLocationSha256!=='string')throw fail();
   if(!equal(record.legacyInstallationRoot,path.win32.join(io.realpath(home),'AppData','Local','SylvanaDesktop')))throw fail();
   const location=path.win32.join(directory,'profile-location.json'),st=io.inspect(location);
   if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>4096||!equal(io.realpath(location),location)||createHash('sha256').update(io.readFile(location)).digest('hex')!==record.profileLocationSha256)throw fail();
   const selected=migratedDesktopProfile(path.win32.join(record.legacyInstallationRoot,'app-0.0.0','Sylvana.exe'),home,io);
   if(!selected||!equal(selected,record.profile))throw fail();return selected;
  }
  // Ordinary profiles remain at their original Windows user data location.
  if(record.profileLocationSha256!==undefined||!equal(record.profile,path.win32.join(home,'AppData','Roaming','Sylvana')))throw fail();
  try{io.inspect(path.win32.join(directory,'profile-location.json'));throw fail();}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw fail();}
  return record.profile;
 }catch{throw fail();}
}
