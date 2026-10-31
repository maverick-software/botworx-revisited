const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createHash}=require('node:crypto');
const {desktopProfile,privateProfilePath}=require(path.join(process.env.SYLVANA_PROFILE_TEST_BUILD||path.resolve(__dirname,'../build'),'desktop-profile.js'));
const home='C:\\Users\\Alice',installation=home+'\\AppData\\Local\\SylvanaDesktop',directory=home+'\\.sylvana\\desktop',source=directory+'\\profile',instance='12345678-1234-4123-8123-123456789abc',target='F:\\Sylvana-Data\\profiles\\'+instance+'\\profile',sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(){
 const migration={format:2,kind:'verified-profile-relocation',status:'complete',source,destination:target,runtimeInstanceId:instance,priorMigrationSha256:'a'.repeat(64),files:3,copyManifestSha256:'b'.repeat(64),encryptedStorageVerified:true,nativeHistoryVerified:true};
 const record={format:2,kind:'verified-profile-migration',installationRoot:installation,profile:target,runtimeInstanceId:instance,migrationSha256:''},files=new Map(),links=new Set(),calls=[];
 const seal=()=>{const text=JSON.stringify(migration);record.migrationSha256=sha(text);files.set(target+'\\profile-migration.json',text);files.set(directory+'\\profile-location.json',JSON.stringify(record));};seal();files.set(target+'\\runtime-binding.json',JSON.stringify({format:1,distribution:'SylvanaRuntime-'+instance,instanceId:instance}));
 const io={realpath:value=>value,mkdir(){throw Error('Profile selection must not create directories')},inspect:value=>{calls.push(value);if(!files.has(value)&&![directory,target].includes(value))throw Object.assign(Error('missing'),{code:'ENOENT'});return {isFile:()=>files.has(value),isDirectory:()=>[directory,target].includes(value),isSymbolicLink:()=>links.has(value),nlink:1,size:Buffer.byteLength(files.get(value)??'')};},readFile:value=>files.get(value)};
 const options={platform:'win32',packaged:true,testProfile:false,exe:installation+'\\app-0.44.54\\Sylvana.exe',home,appData:home+'\\AppData\\Roaming',current:home+'\\AppData\\Roaming\\Sylvana'};
 return {options,migration,record,files,links,calls,io,seal,choose:()=>desktopProfile(options,io)};
}
test('a verified relocation opens the same private profile on another local drive in ordinary and redirected launches',()=>{
 for(const redirected of [false,true]){const f=fixture();if(redirected)f.options.appData=home+'\\AppData\\Local\\Packages\\Host\\LocalCache\\Roaming';assert.equal(f.choose(),target);assert(!f.calls.some(file=>file===source));}
});
test('a relocation cannot select a network path, another runtime folder, an alias spelling or an arbitrary directory',()=>{
 for(const location of ['F:\\','F:relative','\\\\server\\share\\profile','\\\\?\\'+target,'F:\\Public\\profile',target.replace(instance,'22345678-1234-4123-8123-123456789abc'),target+'\\..\\profile',source]){const f=fixture();f.record.profile=location;f.files.set(directory+'\\profile-location.json',JSON.stringify(f.record));assert.throws(f.choose,/profile|migration/i);}
});
test('the relocation receipt must bind its source, destination, runtime and successful encryption/history checks',()=>{
 for(const patch of [{format:1},{kind:'copying'},{source:'C:\\Users\\Bob\\.sylvana\\desktop\\profile'},{destination:target.replace('F:','G:')},{runtimeInstanceId:'22345678-1234-4123-8123-123456789abc'},{priorMigrationSha256:'invalid'},{encryptedStorageVerified:false},{nativeHistoryVerified:false},{files:0},{copyManifestSha256:'invalid'}]){const f=fixture();Object.assign(f.migration,patch);f.seal();assert.throws(f.choose,/profile|migration/i);}
 const f=fixture();f.files.set(target+'\\profile-migration.json',JSON.stringify({...f.migration,files:4}));assert.throws(f.choose,/profile|migration/i);
});
test('foreign installation bindings, replaced runtime bindings and missing relocated state fail before falling back to another account',()=>{
 for(const patch of [{installationRoot:installation.replace('Alice','Bob')},{extra:true},{format:3}]){const f=fixture();Object.assign(f.record,patch);f.files.set(directory+'\\profile-location.json',JSON.stringify(f.record));assert.throws(f.choose,/profile|migration/i);}
 for(const file of [target+'\\runtime-binding.json',target+'\\profile-migration.json']){const f=fixture();f.files.delete(file);assert.throws(f.choose,/profile|migration/i);}
 const f=fixture();f.files.set(target+'\\runtime-binding.json',JSON.stringify({format:1,distribution:'SylvanaRuntime-22345678-1234-4123-8123-123456789abc',instanceId:'22345678-1234-4123-8123-123456789abc'}));assert.throws(f.choose,/profile|migration|binding/i);
});
test('a migration lock prevents opening either profile while the cross-drive selector changes',()=>{
 const f=fixture();f.files.set(directory+'\\migration.lock','owned relocation');assert.throws(f.choose,/profile|migration/i);assert(!f.calls.some(file=>file.startsWith(target)));
});
test('relocated folders and their selection files reject links, foreign physical paths and hardlinked metadata',()=>{
 for(const file of [directory,directory+'\\profile-location.json',target,target+'\\profile-migration.json',target+'\\runtime-binding.json']){const f=fixture();f.links.add(file);assert.throws(f.choose,/profile|migration/i);}
 for(const file of [target,target+'\\runtime-binding.json']){const f=fixture();f.io.realpath=value=>value===file?value.replace('F:','G:'):value;assert.throws(f.choose,/profile|migration/i);}
 const f=fixture(),inspect=f.io.inspect;f.io.inspect=value=>({...inspect(value),nlink:2});assert.throws(f.choose,/profile|migration/i);
});
test('case-only physical spellings preserve the verified runtime identity',()=>{const f=fixture();f.io.realpath=value=>value.startsWith('F:')?value.toLowerCase():value;assert.equal(f.choose(),target);});
test('active and retained cross-drive private profiles remain excluded from attachment and external recovery context',()=>{
 for(const location of [target,target+'\\credentials.bin','G:\\Sylvana-Data\\profiles\\22345678-1234-4123-8123-123456789abc\\profile\\Local State','\\\\?\\'+target+'\\codex','f:\\sylvana-data\\profiles'])assert(privateProfilePath(location),location);
 for(const location of ['F:\\Projects\\report.docx','F:\\Sylvana-Data\\exports\\report.pdf','F:\\Sylvana-Data\\profiles-notes\\notes.txt'])assert(!privateProfilePath(location),location);
});


test('a fresh profile requires a verified retained archive and keeps its separate runtime',()=>{
 const f=fixture(),archived='F:\\Sylvana-Data\\profiles\\22345678-1234-4123-8123-123456789abc\\profile';
 const archive=JSON.stringify({status:'verified-archive',profile:archived,databaseManifestSha256:'a'.repeat(64),profileArchiveSha256:'b'.repeat(64)});
 f.record.format=4;Object.assign(f.migration,{format:4,kind:'verified-fresh-profile',archivedProfile:archived,archiveReceiptSha256:sha(archive)});f.files.set(target+'\\previous-profile-archive.json',archive);f.seal();assert.equal(f.choose(),target);
 f.files.set(target+'\\previous-profile-archive.json',archive+' ');assert.throws(f.choose,/profile|migration/i);
});
