import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
let text=await readFile(path.join(import.meta.dirname,'launch-live-vision61-probe.mjs'),'utf8');
text=text.replace("import {installLiveVisionGuard as installCoordinationGuard} from './install-live-vision61-guard.mjs';","import {installLivePdfGuard as installCoordinationGuard} from './install-live-pdf63-guard.mjs';");
// This launcher records arrays rather than adding an array to numeric counters.
text=text.replaceAll('catalog:globalThis.__coordination.catalog,','catalog:globalThis.__coordination.catalog,tools:globalThis.__coordination.tools,');text=text.replaceAll('(evidence.liveNetwork?.catalog??0)','(evidence.liveNetwork?.catalog?.length??0)');
await writeFile(path.join(import.meta.dirname,'launch-live-pdf63-probe.mjs'),text,{flag:'wx'});
