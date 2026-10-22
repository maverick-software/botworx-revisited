import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
let text=await readFile(path.join(import.meta.dirname,'launch-live-concurrency62-probe.mjs'),'utf8');text=text.replace("import {installLiveConcurrencyGuard as installCoordinationGuard} from './install-live-concurrency62-guard.mjs';","import {installLiveMixedGuard as installCoordinationGuard} from './install-live-mixed63-guard.mjs';");await writeFile(path.join(import.meta.dirname,'launch-live-mixed63-probe.mjs'),text,{flag:'wx'});
