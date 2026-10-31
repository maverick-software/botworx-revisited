const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os'),vm=require('node:vm');
const {legacyOrigin,currentBrandKey,currentBrandKind,currentFileHref,migrateSecretMetadata,legacyPrivateProfilePath}=require('../build/legacy-brand.js');
const {migrateBrandBrowserStorage}=require('../build/brand-storage-migration.js');
const {parseConversationCitation}=require('../build/conversation-links.js');
test('Retained metadata changes names while credentials and authored material keep their exact values',()=>{
 const saved={'agentopia.editor-draft.x':{kind:'agentopia-workspace',text:'Agentopia in a legal document',access_token:'opaque-exact-token',payload:'{"agentopia.original":"draft"}'}};
 const result=migrateSecretMetadata(saved);
 assert(result.changed);assert.deepEqual(result.value['sylvana.editor-draft.x'],{...saved['agentopia.editor-draft.x'],kind:'sylvana-workspace'});
 assert.equal(currentBrandKey('user.agentopia.notes'),'user.agentopia.notes');assert.equal(currentBrandKind('agentopia-desktop-recovery'),'sylvana-desktop-recovery');
 assert(legacyPrivateProfilePath('F:\\Agentopia-Data\\profiles\\abc\\profile'));assert(legacyPrivateProfilePath('C:\\Users\\person\\.agentopia\\desktop\\profile'));
});
test('Existing file and chat references still resolve without rewriting message content',()=>{
 const id='12345678-1234-4123-8123-123456789abc',message='22345678-1234-4123-8123-123456789abc';
 assert.equal(currentFileHref('agentopia-file://'+id+'/notes.md'),'sylvana-file://'+id+'/notes.md');
 assert.deepEqual(parseConversationCitation('agentopia-chat://'+id+'/message/'+message),{conversationId:id,messageId:message});
 assert.throws(()=>parseConversationCitation('agentopia-chat://'+id+'/message/'+message+'?other=1'));
});
test('Browser storage preserves original values, changes only owned keys, and can resume after migration',async t=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'sylvana-brand-'));t.after(()=>fs.rm(profile,{recursive:true,force:true}));
 const original=new Map([['agentopia.editor-draft.owner:editor:new','Exact unsent draft \u6771\u4eac'],['unrelated','keep']]),next=new Map();let url='';
 const page={getURL:()=>url,loadURL:async value=>{url=value;},webContents:{executeJavaScript:async source=>{const store=url.startsWith(legacyOrigin)?original:next;return vm.runInNewContext(source,{localStorage:{get length(){return store.size;},key:n=>[...store.keys()][n],getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v)}});}}};
 await migrateBrandBrowserStorage(profile,page);assert.equal(next.get('sylvana.editor-draft.owner:editor:new'),original.get('agentopia.editor-draft.owner:editor:new'));assert.equal(next.get('unrelated'),'keep');
 const retained=JSON.parse(await fs.readFile(path.join(profile,'pre-sylvana-browser-storage.json'),'utf8'));assert.deepEqual(retained.entries,[...original]);
 await migrateBrandBrowserStorage(profile,page);assert.equal(next.size,2);
});
test('A conflicting new browser value stops migration and keeps the original draft recoverable',async t=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'sylvana-brand-'));t.after(()=>fs.rm(profile,{recursive:true,force:true}));let url='';
 const stores={[legacyOrigin]:new Map([['agentopia.editor-draft.x','older']]),'sylvana://app':new Map([['sylvana.editor-draft.x','newer']])};
 const page={getURL:()=>url,loadURL:async value=>{url=value;},webContents:{executeJavaScript:async source=>{const store=stores[url.split('/draft-')[0]];return vm.runInNewContext(source,{localStorage:{get length(){return store.size;},key:n=>[...store.keys()][n],getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}});}}};
 await assert.rejects(migrateBrandBrowserStorage(profile,page),/conflicts/);assert.equal(stores['sylvana://app'].get('sylvana.editor-draft.x'),'newer');assert.equal(stores[legacyOrigin].get('agentopia.editor-draft.x'),'older');
});
