const {app}=require('electron');
const {mkdtempSync}=require('node:fs'),os=require('node:os'),path=require('node:path'),{pathToFileURL}=require('node:url');
const directory=mkdtempSync(path.join(os.tmpdir(),'npe-'));
app.setPath('userData',directory);app.setPath('sessionData',directory);
// The test hashes and extracts the archive as bytes before loading its copied modules.
process.noAsar=true;
app.whenReady().then(()=>import(pathToFileURL(path.join(__dirname,'test-native-permission-boundaries.mjs')).href)).then(()=>app.exit(process.exitCode??0),error=>{console.error(error);app.exit(1);});
