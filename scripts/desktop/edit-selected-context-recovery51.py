from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[2]
def edit(name,old,new):
    file=ROOT/name;text=file.read_text(encoding='utf-8');assert text.count(old)==1,(name,old[:100],text.count(old));file.write_text(text.replace(old,new),encoding='utf-8',newline='\n')
edit('desktop/src/broker.ts',"let options=chatOptions(args.options);if(options.permission==='full')this.terminal.authorize(user,true);if(!args.conversationId", "let options=chatOptions(args.options);const sources=selectedContextFiles(options.sources,user.id,options.permission);if(options.permission==='full')this.terminal.authorize(user,true);if(!args.conversationId")
edit('desktop/src/broker.ts',"  const sources=selectedContextFiles(options.sources,user.id,options.permission);\n  const context=", "  const context=")
edit('desktop/src/broker.ts',"  const request=delivery?await this.tools.deliveries.begin", "  await this.attachmentOwner(user.id);operation.controller.signal.throwIfAborted();\n  const request=delivery?await this.tools.deliveries.begin")
edit('desktop/src/chat-delivery.ts',"const targetSecurity={permission:","const targetSecurity={sources:target.sources??[],permission:")
edit('desktop/src/chat-delivery.ts',"const deliverySecurity={permission:","const deliverySecurity={sources:options.sources??[],permission:")
edit('desktop/src/recovery-bootstrap.ts',"[2,3,4,5,6,7,8].includes", "[2,3,4,5,6,7,8,9].includes")
edit('desktop/src/portable-backup.ts',"requiresDesktopRecoveryFormat:8", "requiresDesktopRecoveryFormat:9")
edit('desktop/src/portable-backup.ts',"desktop recovery capability 8.", "desktop recovery capability 9.")
edit('scripts/desktop/build.mjs',"desktopRecovery:8", "desktopRecovery:9")
edit('scripts/desktop/import-backup.ps1',"@(2,3,4,5,6,7,8)", "@(2,3,4,5,6,7,8,9)")
edit('desktop/runtime/prepare-desktop-recovery.py',"capability in (2,3,4,5,6,7,8)","capability in (2,3,4,5,6,7,8,9)")
edit('desktop/runtime/prepare-desktop-recovery.py',"    external=None\n", "    external=None\n") if False else None
edit('desktop/runtime/prepare-desktop-recovery.py',"        fail(capability>=8 or not any('completion'", "        fail(capability>=9 or not any('sources' in value for account in settings['accounts'] for value in [account['settings'].get('composer',{}),*[draft.get('options',{}) for draft in account['settings'].get('chat-drafts',{}).values()]]),'Selected source snapshots require a newer recovery capability')\n        fail(capability>=8 or not any('completion'")
edit('desktop/runtime/prepare-desktop-recovery.py',"        if 'notification-preferences' in account['settings']:", "        for value in [account['settings'].get('composer',{}),*[draft.get('options',{}) for draft in account['settings'].get('chat-drafts',{}).values()]]:\n            if 'sources' in value:validate_selected_sources(value['sources'],account['owner'])\n        if 'notification-preferences' in account['settings']:")
edit('desktop/runtime/prepare-desktop-recovery.py',"def validate_settings(record,owners,database_sha):", """def validate_selected_sources(sources,owner):
    fail(isinstance(sources,list) and len(sources)<=10,'Invalid selected source count');seen=set();size=0
    for source in sources:
        fail(isinstance(source,dict) and set(source)=={'kind','id','owner','title','url','text','notice','capturedAt'},'Invalid selected source fields')
        fail(source['kind'] in ('browser','chat') and isinstance(source['id'],str) and re.fullmatch(r'[a-f0-9-]{36}',source['id'],re.I) and source['owner']==owner,'Invalid selected source owner or identity')
        for key,limit in (('title',240),('url',4096),('text',16000),('notice',1000),('capturedAt',40)):fail(isinstance(source[key],str) and len(source[key].encode('utf-16-le'))//2<=limit,'Invalid selected source text')
        fail(source['title'].strip() and source['capturedAt'],'Invalid selected source label or timestamp')
        if source['kind']=='chat':fail(source['url']=='agentopia-chat://'+source['id'],'Invalid selected chat URL')
        else:
            from urllib.parse import urlsplit
            url=urlsplit(source['url']);fail(url.scheme in ('http','https') and url.hostname and not url.username and not url.password,'Invalid selected browser URL')
        key=(source['kind'],source['id'].casefold());fail(key not in seen,'Duplicate selected source');seen.add(key);size+=len(source['text'].encode('utf-16-le'))//2
    fail(size<=80000,'Selected source text is too large')

def validate_settings(record,owners,database_sha):""")
edit('desktop/tests/recovery-bootstrap.test.cjs',"legacy capability 7 and new capability 8", "legacy capabilities 7 and 8 and new capability 9")
edit('desktop/tests/recovery-bootstrap.test.cjs',"[7,8,9]", "[7,8,9,10]")
edit('desktop/tests/recovery-bootstrap.test.cjs',"if(capability!==9)", "if(capability!==10)")
edit('scripts/desktop/test-notification-recovery-launcher.ps1',"$descriptor.requiresDesktopRecoveryFormat=9;", "$descriptor.requiresDesktopRecoveryFormat=10;")
manifest=ROOT/'desktop/src/recovery-resource-manifest.json';value=json.loads(manifest.read_text(encoding='utf-8'));value['files']['runtime/prepare-desktop-recovery.py']=hashlib.sha256((ROOT/'desktop/runtime/prepare-desktop-recovery.py').read_bytes()).hexdigest();manifest.write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
print('Recovery capability 9 accepts bounded account-owned source snapshots; older capabilities remain supported.')
