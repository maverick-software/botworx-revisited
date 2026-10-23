const {app,protocol}=require('electron'),fs=require('node:fs'),path=require('node:path');
const cfg=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(!path.resolve(cfg.temp).toLowerCase().startsWith('f:\\agentopia\\.supabase\\desktop-agent-library71\\'))throw Error('Owned F-drive renderer storage required');
for(const dir of [cfg.temp,path.join(cfg.temp,'appdata'),path.join(cfg.temp,'renderer-profile')])fs.mkdirSync(dir,{recursive:true});app.setPath('appData',path.join(cfg.temp,'appdata'));app.setPath('userData',path.join(cfg.temp,'renderer-profile'));app.setPath('temp',cfg.temp);
protocol.registerSchemesAsPrivileged([{scheme:'agentopia',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{await require('./test-agent-library71-client.cjs');app.exit(process.exitCode||0);}).catch(()=>{console.error('Owned library renderer fixture failed');app.exit(1);});
