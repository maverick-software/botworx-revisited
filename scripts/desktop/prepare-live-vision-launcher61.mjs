import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const folder=import.meta.dirname,source=await readFile(path.join(folder,'launch-live-image-edit60-probe.mjs'),'utf8');
if(!source.includes("import {installLiveImageEditGuard as installCoordinationGuard} from './install-live-image-edit60-guard.mjs';"))throw Error('Unexpected owned probe bootstrap');
await writeFile(path.join(folder,'launch-live-vision61-probe.mjs'),source.replace("import {installLiveImageEditGuard as installCoordinationGuard} from './install-live-image-edit60-guard.mjs';","import {installLiveVisionGuard as installCoordinationGuard} from './install-live-vision61-guard.mjs';"));
