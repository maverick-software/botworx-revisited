// Keep the same private observer and selected failing cases, without changing
// the owned native process's logging environment. Product code remains frozen.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const original=path.join(import.meta.dirname,'diagnose-debug-native50.mjs');
let source=await readFile(original,'utf8');
const setting="RUST_LOG:'codex_app_server=debug,codex_core=debug'";
if(!source.includes(setting))throw Error('The reviewed logging injection changed.');
source=source.replace(setting,'');
const generated=path.join(import.meta.dirname,'diagnose-native-environment50.generated.mjs');
await writeFile(generated,source);
await import(pathToFileURL(generated).href);
