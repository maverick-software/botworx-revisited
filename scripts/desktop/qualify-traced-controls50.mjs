// Retain the complete frozen-archive gate and its documented fixture setup
// allowances. Add private native protocol timing and a live test log so a new
// intermittent failure can be located without another unobserved full rerun.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
let source=await readFile(path.join(import.meta.dirname,'qualify-agent-controls-04450-startup.mjs'),'utf8');
source="import {appendFileSync} from 'node:fs';\n"+source;
const priorObserver='F:/Agentopia/.supabase/desktop-release-04450/1792545647151/native-service-diagnostic/1792549890136/observer.cjs';
const originalTrace='F:\\Agentopia\\.supabase\\desktop-release-04450\\1792545647151\\native-service-diagnostic\\1792549890136\\private-startup.jsonl';
const observer=await readFile(priorObserver,'utf8');assert(observer.includes(JSON.stringify(originalTrace)));
const marker='const env={...process.env,NODE_PATH:';assert(source.includes(marker));
source=source.replace(marker,`const observer=path.join(out,'native-observer.cjs');await writeFile(observer,${JSON.stringify(observer)}.replace(${JSON.stringify(JSON.stringify(originalTrace))},JSON.stringify(path.join(out,'private-native-startup.jsonl'))));\n${marker}`);
const args="['--require',loader,'--test'";assert(source.includes(args));source=source.replace(args,"['--require',loader,'--require',observer,'--test'");
const output="stream.on('data',bytes=>text+=bytes)";assert(source.includes(output));source=source.replace(output,"stream.on('data',bytes=>{text+=bytes;appendFileSync(path.join(out,'live-backend.log'),bytes);})");
const receipt="const evidence={fixtureSetupAdaptations,";assert(source.includes(receipt));source=source.replace(receipt,"const evidence={nativeObserverPreservesArgumentsAndEnvironment:true,earlierFailedRun:'F:/Agentopia/.supabase/desktop-agent-controls50/1792547034238/evidence.json',fixtureSetupAdaptations,");
const generated=path.join(import.meta.dirname,'qualify-traced-controls50.generated.mjs');await writeFile(generated,source);await import(pathToFileURL(generated).href);
