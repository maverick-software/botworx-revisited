import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
let source=await readFile('scripts/desktop/qualify-agent-controls-04463.mjs','utf8');
source=source.replace('after the new backup\n// barrier changed the broker/secrets integration.','including the new Google upload\n// integration and retained agent authorization.').replaceAll('0.44.63','0.44.64').replaceAll('desktop-pdf-pages-release63','desktop-google-editor-release64').replaceAll('desktop-agent-controls63','desktop-agent-controls64').replaceAll('controls63-','controls64-');
const before="names.push('image-attachment-limits','pdf-pages');";assert(source.includes(before));source=source.replace(before,"names.push('image-attachment-limits','pdf-pages','google-documents','google-document-broker','composio-file-transfer');");
source=source.replace('assert(evidence.passed>=943)','assert(evidence.passed>=962)');
const hashed="const sourceHashes={};for(const name of names)sourceHashes[name]=await hash(path.join(tests,name+'.test.cjs'));";assert(source.includes(hashed));source=source.replace(hashed,"const sourceHashes={};for(const name of names){sourceHashes[name]=await hash(path.join(tests,name+'.test.cjs'));assert.equal(sourceHashes[name],proof.sourceHashes['tests/'+name+'.test.cjs']);}");
await writeFile('scripts/desktop/qualify-agent-controls-04464.mjs',source);
