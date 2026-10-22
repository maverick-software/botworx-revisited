import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');let text=await readFile(path.join(root,'scripts/desktop/launch-live-report57-probe.mjs'),'utf8');
text=text.replace("import {installLiveReportGuard as installCoordinationGuard} from './install-live-report57-guard.mjs';","import {installLiveImageEditGuard as installCoordinationGuard} from './install-live-image-edit60-guard.mjs';");
const old="({calls:globalThis.__coordination.calls,blocked:globalThis.__coordination.blocked,errors:globalThis.__coordination.errors})";
assert(text.includes(old));text=text.replaceAll(old,"({calls:globalThis.__coordination.calls,blocked:globalThis.__coordination.blocked,errors:globalThis.__coordination.errors,catalog:globalThis.__coordination.catalog,catalogCalls:globalThis.__coordination.catalogCalls,imagePosts:globalThis.__coordination.imagePosts,imageMetadata:globalThis.__coordination.imageMetadata})");
text=text.replace("evidence.externalRequestsAttempted=(evidence.liveNetwork?.calls.length??0)+(evidence.liveNetwork?.catalog??0);","evidence.externalRequestsAttempted=(evidence.liveNetwork?.calls.length??0)+(evidence.liveNetwork?.catalog??0)+(evidence.liveNetwork?.imagePosts?.length??0)+(evidence.liveNetwork?.imageMetadata?.length??0);evidence.imageRequests=evidence.liveNetwork?.imagePosts?.length??0;");
await writeFile(path.join(root,'scripts/desktop/launch-live-image-edit60-probe.mjs'),text,{flag:'wx'});console.log('Prepared actual-response launcher with separate model, metadata and image submission counts.');
