import {realpathSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {migratedDesktopProfile,type ProfileLocationIO} from './desktop-profile-location';
import {wizardDesktopProfile} from './wizard-profile';
import {legacyPrivateProfilePath,legacyPrivateFolder} from './legacy-brand';

// Retained profiles remain credential stores after a standalone migration.
// Protect the known Windows layouts even when another profile is active.
export function privateProfilePath(value:string){
 if(legacyPrivateProfilePath(value))return true;
 const normalized=path.win32.normalize(value).replace(/^\\\\\?\\(?=[a-z]:\\)/i,'');
 return /(?:^|\\)AppData\\(?:Roaming|Local\\Packages\\[a-z0-9_.-]+\\LocalCache\\Roaming)\\Sylvana(?:-before-[a-f0-9-]{36})?(?:\\|$)/i.test(normalized)||/(?:^|\\)\.sylvana\\desktop(?:\\|$)/i.test(normalized)||/(?:^|\\)\.sylvana-recovery(?:-[a-f0-9]{12})?(?:\\|$)/i.test(normalized)||/^[a-z]:\\Sylvana-Data\\profiles(?:\\|$)/i.test(normalized);
}

// A Store-hosted installer can be redirected into its host's private LocalCache.
// Explorer launches that same executable without the host's filesystem view.
// Derive the original Roaming directory from the physical installation, before
// Electron initializes its session and credential-encryption key.
export function packageCacheProfile(exe:string,appData:string):string|undefined{
 const installed=path.win32.normalize(exe),roaming=path.win32.normalize(appData);
 const match=/^([a-z]:\\.+?\\AppData)\\Local\\Packages\\([a-z0-9_.-]+)\\LocalCache\\Local\\SylvanaDesktop\\app-\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?\\Sylvana\.exe$/i.exec(installed);
 if(!match||roaming.toLowerCase()!==path.win32.join(match[1],'Roaming').toLowerCase())return;
 return path.win32.join(match[1],'Local','Packages',match[2],'LocalCache','Roaming','Sylvana');
}

type ProfileOptions={platform:string;packaged:boolean;testProfile:boolean;exe:string;appData:string;current:string;home?:string};
type ProfileIO={realpath:(value:string)=>string;mkdir:(value:string)=>void}&Partial<ProfileLocationIO>;
const nativeIO:ProfileIO={realpath:value=>realpathSync.native(value),mkdir:value=>{mkdirSync(value,{recursive:true});}};
export function desktopProfile(options:ProfileOptions,io:ProfileIO=nativeIO):string{
 if(options.platform!=='win32'||!options.packaged||options.testProfile)return options.current;
 const physical=io.realpath(options.exe),migrated=migratedDesktopProfile(physical,options.home,io.inspect&&io.readFile?io as ProfileLocationIO:undefined);
 if(migrated)return migrated;
 const wizard=wizardDesktopProfile(physical,options.home,io.inspect&&io.readFile?io as ProfileLocationIO:undefined);
 if(wizard)return wizard;
 if(options.home&&existsSync(path.join(options.home,legacyPrivateFolder,'desktop/profile-location.json')))throw Error('The existing local workspace must complete its verified Sylvana migration before this installation can open.');
 const candidate=packageCacheProfile(physical,options.appData);
 if(!candidate)return options.current;
 io.mkdir(candidate);return candidate;
}
