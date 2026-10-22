const {app}=require('electron'),path=require('node:path'),os=require('node:os'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nr-host-'));app.setPath('userData',profile);app.setPath('sessionData',profile);app.commandLine.appendSwitch('disable-background-networking');
process.noAsar=true;
app.whenReady().then(()=>import(pathToFileURL(path.join(__dirname,'test-native-provider-refusals.mjs')).href)).then(()=>app.exit(process.exitCode??0),error=>{console.error(error);app.exit(1);});
