import assert from 'node:assert/strict';
import path from 'node:path';
export const installedUpdater='C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\Update.exe';
export const installedUpdaterSha256='76359cd4b0349a83337b941332ad042c90351c2bb0a4628307740324c97984cc';
export function maintenanceUpdateCommand({releaseDirectory,temp,environment=process.env}){
 const directory=path.win32.normalize(releaseDirectory),scratch=path.win32.normalize(temp);
 assert(/^F:\\Agentopia\\\.supabase\\desktop-chart-format-release62\\\d{13}\\installer-build-short\\output$/.test(directory),'Unexpected verified release directory');assert(/^F:\\Agentopia-Tmp\\update62-\d{13}$/.test(scratch),'Unexpected update scratch location');
 const env={...environment,TEMP:scratch,TMP:scratch,SQUIRREL_TEMP:scratch};for(const key of ['ELECTRON_RUN_AS_NODE','AGENTOPIA_TEST_PROFILE','NODE_OPTIONS'])delete env[key];return {exe:installedUpdater,args:['--update',directory],cwd:directory,env};
}
