"""Prepare a verified full desktop recovery without starting WSL or inference.

The public CLI targets this Windows user's fresh profile only. Tests call the
library with isolated homes and explicit environment observations. An interrupted
operation remains visible and must be resumed with the same sealed bundle.
"""
from pathlib import Path, PurePosixPath
import argparse, base64, hashlib, importlib.util, json, ntpath, os, re, shutil, sqlite3, subprocess, tarfile, uuid
from contextlib import contextmanager
from datetime import datetime

DATABASE_FILES={'auth.dump','application.dump','vault.dump','database.dump','recovery.dump','pgsodium_root.key'}
UUID=re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',re.I)

def fail(condition,message):
    if not condition: raise ValueError(message)

def digest(file):
    with Path(file).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()

def safe_name(name):
    fail(isinstance(name,str) and name and str(PurePosixPath(name))==name and not PurePosixPath(name).is_absolute(),'Invalid recovery member path')
    parts=name.split('/')
    fail(all(p not in ('.','..','') and not re.search(r'[\\:\x00-\x1f\x7f<>"|?*]',p) and not p.endswith(('.',' ')) and not re.match(r'^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)',p,re.I) for p in parts),'Unsafe recovery member path')
    return parts

def no_links(file,required=False):
    file=Path(file).absolute()
    for item in [file,*file.parents]:
        fail(not item.is_symlink() and not getattr(item,'is_junction',lambda:False)(),'Recovery path contains a link or junction')
        if item.exists():fail(item.resolve()==item,'Recovery path is redirected')
    if required:fail(file.exists(),'Recovery resource is missing')
    if file.is_file():fail(file.stat().st_nlink==1,'Recovery files must not be hard-linked')
    return file

def brand_kind(value):
    former='agen'+'topia'
    return 'sylvana'+value[len(former):] if isinstance(value,str) and value.startswith(former+'-') else value

def load(file,maximum=16*1024**2):
    no_links(file,True);fail(Path(file).stat().st_size<=maximum,'Recovery metadata is too large')
    return json.loads(Path(file).read_text(encoding='utf-8-sig'))

def save(file,value):
    file=Path(file);temporary=file.with_name(file.name+'.'+str(uuid.uuid4())+'.tmp')
    with temporary.open('x',encoding='utf-8') as stream:json.dump(value,stream,indent=2);stream.flush();os.fsync(stream.fileno())
    os.replace(temporary,file)

def json_with_js_strings(value):
    """Keep compact producer JSON and JavaScript's well-formed UTF-16 strings.

    Lone surrogates must be escaped; a pair represents one Unicode code point.
    The saved-draft envelope uses only bounded integers outside its raw text.
    """
    text=json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    def replacement(match):
        value=match[0];code=ord(value[0])
        return chr(0x10000+((code-0xD800)<<10)+ord(value[1])-0xDC00) if len(value)==2 else '\\u%04x'%code
    return re.sub(r'[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]',replacement,text)

def utf16_length(value):return len(value.encode('utf-16-le','surrogatepass'))//2

def editor_timestamp(value):
    if not isinstance(value,str) or not re.fullmatch(r'(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z',value):return False
    try:moment=datetime.fromisoformat(value[:-1]+'+00:00')
    except ValueError:return False
    return moment.isoformat(timespec='milliseconds').replace('+00:00','Z')==value

def save_compact_settings(file,value):
    file=Path(file);temporary=file.with_name(file.name+'.'+str(uuid.uuid4())+'.tmp')
    with temporary.open('x',encoding='utf-8',newline='') as stream:stream.write(json_with_js_strings(value));stream.flush();os.fsync(stream.fileno())
    os.replace(temporary,file)

def resource(root,record):
    file=root.joinpath(*safe_name(record['file']));no_links(file,True)
    fail(re.fullmatch('[a-f0-9]{64}',record['sha256']) and digest(file)==record['sha256'],'A sealed recovery resource changed')
    return file

def inventory(manifest,public=False):
    fail(isinstance(manifest.get('files'),dict) and isinstance(manifest.get('directories'),list),'Invalid recovery inventory')
    fail(len(manifest['files'])<=100000 and len(manifest['directories'])<=100000,'Recovery inventory exceeds its supported size')
    seen=set();directories=set(manifest['directories'])
    for name in [*manifest['directories'],*manifest['files']]:
        parts=safe_name(name);fail(name.casefold() not in seen,'Duplicate recovery path');seen.add(name.casefold())
        for i in range(1,len(parts)):fail('/'.join(parts[:i]) in directories,'Recovery inventory lacks a parent directory')
        if public:fail(re.fullmatch('[a-f0-9]{12}',parts[0],re.I) and (len(parts)==1 or UUID.fullmatch(parts[1])),'Invalid public output ownership')
        if name in manifest['files']:
            row=manifest['files'][name];size=row.get('bytes',row.get('size'))
            fail(isinstance(size,int) and size>=0 and re.fullmatch('[a-f0-9]{64}',row['sha256']),'Invalid recovery file fingerprint')
            if public:fail(len(parts)>=3,'A public file lacks an account owner')
    return manifest

def verify_archive(archive,manifest):
    seen=set();files=set();directories=set()
    with tarfile.open(archive,'r:gz') as tar:
        for member in tar:
            name=member.name.rstrip('/');safe_name(name);fail(name.casefold() not in seen,'Duplicate archive entry');seen.add(name.casefold())
            if member.isdir():fail(name in manifest['directories'],'Unlisted archive directory');directories.add(name)
            else:
                fail(member.isfile() and name in manifest['files'],'Unlisted or linked archive file');row=manifest['files'][name]
                fail(member.size==row['bytes'],'Archive file size differs')
                with tar.extractfile(member) as stream:fail(hashlib.file_digest(stream,'sha256').hexdigest()==row['sha256'],'Archive file bytes differ')
                files.add(name)
    fail(files==set(manifest['files']) and directories==set(manifest['directories']),'Archive is incomplete')

def validate_editor_journal_archive(archive,capability):
    """Preserve opaque journal bytes; validate their sealed file envelopes.

    Receipt interpretation and reference checks occur in the application before
    startup uses a retirement. An older reader must not bypass that behavior.
    """
    count=0;total=0
    with tarfile.open(archive,'r:gz') as tar:
        for member in tar:
            parts=PurePosixPath(member.name).parts
            if not parts or parts[0]!='editor-draft-journals' or member.isdir():continue
            match=re.fullmatch(r'([0-9]{16})-([a-f0-9]{64})\.json',parts[-1]);count+=1;total+=member.size
            fail(len(parts)==2 and match is not None and count<=10000 and total<=512*1024**2 and member.size<=128*1024**2,'Editor journal envelope exceeds its recovery limit')
            with tar.extractfile(member) as stream:data=stream.read()
            fail(hashlib.sha256(data).hexdigest()==match[2],'Editor journal content seal differs')
            row=json.loads(data.decode('utf-8'))
            fail(isinstance(row,dict) and set(row)=={'version','sequence','key','raw'} and type(row['version']) is int and row['version']==1 and type(row['sequence']) is int and 1<=row['sequence']<=9007199254740991 and row['sequence']==int(match[1]),'Invalid editor journal envelope')
            fail(isinstance(row['key'],str) and utf16_length(row['key'])<=512 and '\0' not in row['key'] and row['key'].startswith(('sylvana.editor-draft.','sylvana.preview.')) and isinstance(row['raw'],str) and utf16_length(row['raw'])<=16000000,'Invalid editor journal text')
            if re.fullmatch(r'sylvana\.(?:editor-draft\.[a-f0-9-]{36}:(?:preview|builder):new:|preview\.[a-f0-9-]{36}:new:)[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',row['key']):fail(capability>=17,'Creation-bound preview journals require a newer recovery capability')
            try:marker=json.loads(row['raw'])
            except (ValueError,TypeError):continue
            if isinstance(marker,dict) and brand_kind(marker.get('kind'))=='sylvana-editor-draft-retirement':fail(capability>=16,'Editor draft retirements require a newer recovery capability')

def validate_bundle(root):
    root=no_links(root,True);descriptor=load(root/'desktop-recovery.json')
    fail(not (root/'BACKUP-INCOMPLETE.txt').exists() and not (root/'WORKSPACE-BACKUP-INCOMPLETE.txt').exists(),'This recovery bundle was marked incomplete')
    fail(descriptor.get('format')==2 and brand_kind(descriptor.get('kind'))=='sylvana-desktop-recovery' and descriptor.get('codex')=='0.163.0','Unsupported desktop recovery format')
    capability=descriptor.get('requiresDesktopRecoveryFormat',2);fail(capability in (2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18),'Unsupported desktop recovery capability')
    fail(capability>=3 or not any(name in descriptor for name in ('clipboardArchive','clipboardManifest')),'Clipboard recovery requires a newer recovery capability')
    database_path=resource(root,descriptor['databaseManifest']);database=load(database_path);fail(database.get('format')==1,'Unsupported database recovery format')
    names=set()
    for row in database['files']:
        name=row['name'];fail(name in DATABASE_FILES and name not in names,'Invalid database recovery resource');names.add(name)
        resource(root,{'file':database_path.parent.relative_to(root).as_posix()+'/'+name,'sha256':row['sha256']})
    fail({'auth.dump','application.dump','vault.dump','pgsodium_root.key'}<=names,'Database recovery is missing required resources')
    profile_archive=resource(root,descriptor['profileArchive']);profile=load(resource(root,descriptor['profileManifest']));inventory(profile['manifest'])
    fail(profile.get('success') and profile['archiveSha256']==descriptor['profileArchive']['sha256'],'Private profile checkpoint mismatch')
    fail(capability>=13 or not any(name.split('/')[0]=='draft-previews' for name in [*profile['manifest']['directories'],*profile['manifest']['files']]),'Agent draft preview histories require a newer recovery capability')
    fail(capability>=14 or not any(name.split('/')[0]=='editor-draft-journals' for name in [*profile['manifest']['directories'],*profile['manifest']['files']]),'Emergency editor journals require a newer recovery capability')
    public_archive=resource(root,descriptor['publicArchive']);public=load(resource(root,descriptor['publicManifest']));inventory(public['manifest'],True)
    fail(public.get('success') and public['archiveSha256']==descriptor['publicArchive']['sha256'],'Public output checkpoint mismatch')
    references=load(resource(root,descriptor['references']));index=references['index']
    fail(references.get('format')==1 and brand_kind(references.get('kind'))=='sylvana-restored-public-files' and references['inventory']==public['manifest'] and references['archiveSha256']==public['archiveSha256'],'Public attachment checkpoint mismatch')
    canonical=json.dumps(index,ensure_ascii=False,separators=(',',':')).encode('utf-8')
    fail(hashlib.sha256(canonical).hexdigest()==references['indexSha256'],'Public attachment index changed')
    fail(index.get('format')==1 and len(index['accounts'])==database['accounts'],'Recovered account scope differs from the database checkpoint')
    owners=set()
    for account in index['accounts']:
        owner=account['owner'];fail(UUID.fullmatch(owner) and owner.casefold() not in owners,'Invalid recovered account identity');owners.add(owner.casefold());ids=set();paths=set()
        for ref in account['references']:
            parts=safe_name(ref['relativePath']);fail(len(parts)>=2 and parts[1].casefold()==owner.casefold() and UUID.fullmatch(ref['id']) and ref['id'].casefold() not in ids and ref['relativePath'].casefold() not in paths and ref['name']==parts[-1],'Invalid recovered attachment ownership')
            fail((ref['kind']=='file' and ref['relativePath'] in public['manifest']['files']) or (ref['kind']=='folder' and ref['relativePath'] in public['manifest']['directories']),'Recovered attachment is absent')
            if 'formerPaths' in ref:fail(isinstance(ref['formerPaths'],list) and len(ref['formerPaths'])<=32 and all(isinstance(name,str) and len(name)<=4000 and (ntpath.isabs(name) or Path(name).is_absolute()) and not re.search(r'[\x00-\x1f\x7f]',name) for name in ref['formerPaths']),'Invalid former attachment paths')
            ids.add(ref['id'].casefold());paths.add(ref['relativePath'].casefold())
    fail(public.get('privateProfileArchiveSha256')==profile['archiveSha256'] and public.get('logicalManifestSha256')==descriptor['databaseManifest']['sha256'],'Recovery parts were captured from different checkpoints')
    verify_archive(profile_archive,profile['manifest']);validate_editor_journal_archive(profile_archive,capability);verify_archive(public_archive,public['manifest'])
    clipboard=None;clipboard_archive=None
    fail(capability>=4 or 'settingsManifest' not in descriptor,'Settings recovery requires a newer recovery capability')
    if capability>=3:
        clipboard_archive=resource(root,descriptor['clipboardArchive']);clipboard=load(resource(root,descriptor['clipboardManifest']));validate_clipboard(clipboard,owners,database)
        fail(clipboard['archiveSha256']==descriptor['clipboardArchive']['sha256'],'Clipboard archive checkpoint mismatch');verify_archive(clipboard_archive,clipboard['manifest'])
        fail(not any(name.split('/')[0]=='attachments' for name in profile['manifest']['files']),'Portable image recovery cannot import original Windows image ciphertext')
    fail(capability>=5 or not any(name in descriptor for name in ('externalArchive','externalManifest')),'External recovery requires a newer recovery capability')
    fail(capability>=5 or not any(ref.get('formerPaths') for account in index['accounts'] for ref in account['references']),'Former paths require a newer recovery capability')
    settings=None
    if capability>=4:
        fail('settingsManifest' in descriptor,'Portable settings resource is required')
        settings=load(resource(root,descriptor['settingsManifest']),64*1024**2);validate_settings(settings,owners,descriptor['databaseManifest']['sha256'])
        fail(capability>=13 or not any('agent-editor-drafts' in account['settings'] for account in settings['accounts']),'Agent editor draft recovery requires a newer recovery capability')
        fail(capability>=15 or not any(len(account['settings'].get('agent-editor-drafts',{}))>100 for account in settings['accounts']),'Saved draft revision history requires a newer recovery capability')
        fail(capability>=17 or not any(scope.startswith(('preview:new:','builder:new:')) for account in settings['accounts'] for scope in account['settings'].get('agent-editor-drafts',{})),'Creation-bound preview drafts require a newer recovery capability')
        fail(capability>=10 or not any('composio-state' in account['settings'] for account in settings['accounts']),'Composio connections require a newer recovery capability')
        fail(capability>=11 or not any('google-documents' in account['settings'] for account in settings['accounts']),'Google document operations require a newer recovery capability')
        fail(capability>=7 or not any('notification-preferences' in account['settings'] for account in settings['accounts']),'Notification settings require a newer recovery capability')
        fail(capability>=9 or not any('sources' in value for account in settings['accounts'] for value in [account['settings'].get('composer',{}),*[draft.get('options',{}) for draft in account['settings'].get('chat-drafts',{}).values()]]),'Selected source snapshots require a newer recovery capability')
        fail(capability>=8 or not any('completion' in account['settings'].get('notification-preferences',{}) for account in settings['accounts']),'Notification modes and attention alerts require a newer recovery capability')
    external=None;external_archive=None
    if capability>=5:
        fail('externalArchive' in descriptor and 'externalManifest' in descriptor,'External recovery resources are required')
        external_archive=resource(root,descriptor['externalArchive']);external=load(resource(root,descriptor['externalManifest']));validate_external(external,owners,descriptor['databaseManifest']['sha256'])
        fail(external['archiveSha256']==descriptor['externalArchive']['sha256'],'External archive checkpoint mismatch');verify_archive(external_archive,external['manifest'])
        public_names={name.casefold() for name in [*public['manifest']['directories'],*public['manifest']['files']]};fail(not any(name.casefold() in public_names for name in [*external['manifest']['directories'],*external['manifest']['files']]),'External files overlap the public checkpoint')
    workspace=None;workspace_archive=None;workspace_path=None
    fail(capability>=12 or not any(name in descriptor for name in ('workspaceManifest','workspaceArchive')),'Scheduled workspaces require a newer recovery capability')
    if capability==12 or 'workspaceManifest' in descriptor or 'workspaceArchive' in descriptor:
        fail('workspaceManifest' in descriptor and 'workspaceArchive' in descriptor,'Scheduled workspace recovery resources are required')
        workspace_path=resource(root,descriptor['workspaceManifest']);workspace=load(workspace_path,64*1024**2);workspace_archive=resource(root,descriptor['workspaceArchive'])
        fail(workspace.get('format')==1 and brand_kind(workspace.get('kind'))=='sylvana-portable-workspaces' and re.fullmatch('[a-f0-9]{64}',workspace.get('indexSha256','')) and workspace.get('archiveSha256')==descriptor['workspaceArchive']['sha256'],'Invalid scheduled workspace checkpoint')
        records=workspace.get('records',{});accounts=records.get('accounts',[])
        fail(records.get('format')==1 and brand_kind(records.get('kind'))=='sylvana-workspace-owner-records' and records.get('databaseManifestSha256')==descriptor['databaseManifest']['sha256'] and isinstance(accounts,list) and len(accounts)==len(owners) and {account.get('owner') for account in accounts}==owners and set(database.get('accountIds',[]))==owners,'Scheduled workspace owners differ from the database snapshot')
        fail(isinstance(workspace.get('references'),list),'Scheduled workspace current attachment index is required');ids=set();counts={owner:0 for owner in owners}
        for ref in workspace['references']:
            fail(ref.get('owner') in owners and UUID.fullmatch(ref.get('id','')) and ref.get('kind') in ('file','folder') and (ref['owner'],ref['id']) not in ids,'Invalid scheduled workspace attachment identity');ids.add((ref['owner'],ref['id']));counts[ref['owner']]+=1
        fail(all(count<=100 for count in counts.values()),'Scheduled workspace attachment limit exceeded')
        # This preparer stages sealed opaque bytes only. The installed app
        # performs deep graph/tar validation before declaring recovery ready.
    fail(capability>=6 or 'layoutsManifest' not in descriptor,'Workspace layouts require a newer recovery capability')
    layouts=None
    if capability>=6:
        fail('layoutsManifest' in descriptor,'Portable layout resource is required')
        layouts=load(resource(root,descriptor['layoutsManifest']));validate_layouts(layouts,owners,descriptor['databaseManifest']['sha256'],index,external,workspace)
    windows=None
    fail(capability>=18 or 'windowsProfileManifest' not in descriptor,'Windows credential recovery requires a newer recovery capability')
    if capability>=18:
        fail('windowsProfileManifest' in descriptor,'The encrypted Windows credential checkpoint is required')
        windows=load(resource(root,descriptor['windowsProfileManifest']),1024*1024)
        fail(isinstance(windows,dict) and set(windows)=={'format','kind','databaseManifestSha256','accountIds','windowsSid','encryptionKeySha256','requiresOriginalWindowsAccount','files'} and windows['format']==1 and windows['kind']=='sylvana-same-windows-profile' and windows['databaseManifestSha256']==descriptor['databaseManifest']['sha256'] and windows['requiresOriginalWindowsAccount'] is True,'Invalid Windows credential checkpoint binding')
        fail(isinstance(windows['accountIds'],list) and len(windows['accountIds'])==len(owners) and set(windows['accountIds'])==owners and set(database.get('accountIds',[]))==owners,'Windows credential owners differ from the database snapshot')
        fail(isinstance(windows['windowsSid'],str) and re.fullmatch(r'S-1-\d+(?:-\d+){1,15}',windows['windowsSid']) and re.fullmatch(r'[a-f0-9]{64}',windows['encryptionKeySha256']),'Invalid Windows credential account or encryption binding')
        fail(isinstance(windows['files'],dict) and set(windows['files'])=={'credentials.bin','Local State'},'Invalid Windows credential checkpoint files')
        for name,row in windows['files'].items():
            fail(isinstance(row,dict) and set(row)=={'bytes','sha256'} and type(row['bytes']) is int and 0<row['bytes']<=(64 if name=='credentials.bin' else 32)*1024**2 and isinstance(row['sha256'],str) and re.fullmatch(r'[a-f0-9]{64}',row['sha256']),'Invalid Windows credential checkpoint file seal')
            file=resource(root,{'file':'windows-profile/'+name,'sha256':row['sha256']});fail(file.stat().st_size==row['bytes'],'Windows credential checkpoint size changed')
        fail(windows_encryption_key(load(root/'windows-profile/Local State',32*1024**2))==windows['encryptionKeySha256'],'Windows credential encryption key changed')
    return {'root':root,'descriptor':descriptor,'descriptorSha256':digest(root/'desktop-recovery.json'),'databasePath':database_path,'database':database,'profileArchive':profile_archive,'profile':profile,'publicArchive':public_archive,'public':public,'references':references,'clipboardArchive':clipboard_archive,'clipboard':clipboard,'settings':settings,'externalArchive':external_archive,'external':external,'layouts':layouts,'workspace':workspace,'workspacePath':workspace_path,'workspaceArchive':workspace_archive,'windows':windows}

def windows_encryption_key(local_state):
    key=local_state.get('os_crypt',{});fail(isinstance(key,dict) and isinstance(key.get('encrypted_key'),str) and key['encrypted_key'],'Missing Windows encryption key')
    return hashlib.sha256(json.dumps([key['encrypted_key'],key.get('app_bound_encrypted_key')],ensure_ascii=False,separators=(',',':')).encode()).hexdigest()

def current_windows_sid():
    if os.name!='nt':return None
    result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],capture_output=True,text=True,encoding='utf-8',timeout=10,creationflags=0x08000000)
    sid=result.stdout.strip();fail(result.returncode==0 and re.fullmatch(r'S-1-\d+(?:-\d+){1,15}',sid),'The current Windows recovery account could not be identified');return sid

def validate_layouts(record,owners,database_sha,index,external,workspace=None):
    fail(record.get('format')==1 and brand_kind(record.get('kind'))=='sylvana-portable-layouts' and record.get('databaseManifestSha256')==database_sha and isinstance(record.get('accounts'),list),'Invalid portable layout record')
    base={key:record[key] for key in ('format','kind','databaseManifestSha256','window','accounts')};fail(hashlib.sha256(json.dumps(base,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==record.get('indexSha256'),'Portable layout record changed')
    window=record['window']
    if window is not None:
        bounds=window.get('bounds');fail(isinstance(bounds,dict) and set(bounds)=={'x','y','width','height'} and all(type(bounds[key]) is int and abs(bounds[key])<=1000000 for key in bounds) and bounds['width']>0 and bounds['height']>0 and type(window.get('maximized')) is bool,'Invalid portable window geometry')
    expected={owner:{} for owner in owners}
    for source in [index,*([external] if external else [])]:
        for account in source['accounts']:
            for ref in account['references']:expected[account['owner']][ref['id']]=ref['kind']
    if workspace:
        for ref in workspace['references']:
            fail(ref['id'] not in expected[ref['owner']],'Scheduled workspace attachment duplicates an ordinary recovered attachment');expected[ref['owner']][ref['id']]=ref['kind']
    found=set()
    for account in record['accounts']:
        owner=account['owner'];fail(owner in owners and owner not in found and isinstance(account.get('references'),list),'Invalid layout account');found.add(owner);refs=account['references'];fail(len(refs)<=100 and len({ref['id'] for ref in refs})==len(refs) and {ref['id']:ref['kind'] for ref in refs}==expected[owner],'Layout references differ from owned attachments')
        display=account['display'];fail(isinstance(display,dict) and set(display)<={'context','agents','projects','modes','completed','scheduled','projectFolders'},'Invalid display preference fields')
        for key in ('context','agents','projects'):
            if key in display:fail(display[key] in ('open','closed'),'Invalid sidebar display choice')
        if 'modes' in display:
            modes=display['modes'];fail(isinstance(modes,dict) and set(modes)=={'defaultMode','projects','chats'} and modes['defaultMode'] in ('chatgpt','codex'),'Invalid workspace modes')
            for key in ('projects','chats'):fail(isinstance(modes[key],dict) and len(modes[key])<=1000 and all(UUID.fullmatch(name) and mode in ('chatgpt','codex') for name,mode in modes[key].items()),'Invalid workspace mode choices')
        if 'completed' in display:fail(isinstance(display['completed'],list) and len(display['completed'])<=500 and all(isinstance(name,str) and UUID.fullmatch(name) for name in display['completed']),'Invalid completed chat indicators')
        if 'scheduled' in display:fail(isinstance(display['scheduled'],str) and UUID.fullmatch(display['scheduled']),'Invalid selected scheduled task')
        if 'projectFolders' in display:fail(isinstance(display['projectFolders'],dict) and len(display['projectFolders'])<=1000 and all(UUID.fullmatch(name) and type(value) is bool for name,value in display['projectFolders'].items()),'Invalid project folder choices')
        panes=account['panes'];fail(isinstance(panes,dict) and len(panes)<=5000,'Invalid workspace layouts')
        for scope,pane in panes.items():
            fail(scope=='home' or UUID.fullmatch(scope),'Invalid workspace layout scope');fail(isinstance(pane,dict) and type(pane.get('open')) is bool and type(pane.get('tree')) is bool and isinstance(pane.get('tabs'),list) and len(pane['tabs'])<=16,'Invalid workspace pane');tabs=set()
            for tab in pane['tabs']:
                fail(UUID.fullmatch(tab['id']) and tab['id'] not in tabs and tab['kind'] in ('file','folder','goal','plan','conversation','changes'),'Invalid portable workspace tab');tabs.add(tab['id'])
                if tab['kind'] in ('file','folder'):fail(tab.get('referenceId') in expected[owner] and isinstance(tab.get('path'),str) and len(tab['path'])<=500 and not tab['path'].startswith('/') and not re.search(r'[\\:\x00-\x1f\x7f]',tab['path']) and not any(part in ('.','..') for part in tab['path'].split('/')),'Invalid portable file tab')
    fail(found==owners,'Portable layout owners differ from the database snapshot')

def validate_external(record,owners,database_sha):
    fail(record.get('format')==1 and brand_kind(record.get('kind'))=='sylvana-portable-external' and record.get('databaseManifestSha256')==database_sha and isinstance(record.get('accounts'),list),'Invalid external recovery record')
    base={key:record[key] for key in ('format','kind','sourceRoot','sourceProfile','databaseManifestSha256','accounts','manifest','archiveSha256')}
    fail(hashlib.sha256(json.dumps(base,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==record.get('indexSha256'),'External recovery index changed');inventory(record['manifest'],True)
    found=set();references=[]
    for account in record['accounts']:
        fail(account['owner'] in owners and account['owner'] not in found and isinstance(account['references'],list) and len(account['references'])<=100,'Invalid external account');found.add(account['owner']);ids=set()
        for ref in account['references']:
            parts=safe_name(ref['relativePath']);fail(UUID.fullmatch(ref['id']) and ref['id'].casefold() not in ids and len(parts)==4 and parts[1]==account['owner'] and parts[2]=='external-'+ref['id'] and parts[3]==ref['name'] and isinstance(ref['formerPath'],str) and len(ref['formerPath'])<=4000 and (ntpath.isabs(ref['formerPath']) or Path(ref['formerPath']).is_absolute()) and not re.search(r'[\x00-\x1f\x7f]',ref['formerPath']) and ref['kind'] in ('file','folder'),'Invalid external attachment ownership');ids.add(ref['id'].casefold());references.append(ref)
            fail(ref['relativePath'] in (record['manifest']['files'] if ref['kind']=='file' else record['manifest']['directories']),'External reference is absent')
    fail(found==owners,'External recovery owners differ from the database snapshot')
    for name in record['manifest']['files']:fail(any(name==ref['relativePath'] or ref['kind']=='folder' and name.startswith(ref['relativePath']+'/') for ref in references),'Unowned external recovery bytes')
    for name in record['manifest']['directories']:fail(any(ref['relativePath'].startswith(name+'/') or ref['kind']=='folder' and (name==ref['relativePath'] or name.startswith(ref['relativePath']+'/')) for ref in references),'Unowned external recovery directory')

def validate_selected_sources(sources,owner):
    fail(isinstance(sources,list) and len(sources)<=10,'Invalid selected source count');seen=set();size=0
    for source in sources:
        fail(isinstance(source,dict) and set(source)=={'kind','id','owner','title','url','text','notice','capturedAt'},'Invalid selected source fields')
        fail(source['kind'] in ('browser','chat') and isinstance(source['id'],str) and re.fullmatch(r'[a-f0-9-]{36}',source['id'],re.I) and source['owner']==owner,'Invalid selected source owner or identity')
        for key,limit in (('title',240),('url',4096),('text',16000),('notice',1000),('capturedAt',40)):fail(isinstance(source[key],str) and len(source[key].encode('utf-16-le'))//2<=limit,'Invalid selected source text')
        fail(source['title'].strip() and source['capturedAt'],'Invalid selected source label or timestamp')
        if source['kind']=='chat':fail(source['url']=='sylvana-chat://'+source['id'],'Invalid selected chat URL')
        else:
            from urllib.parse import urlsplit
            url=urlsplit(source['url']);fail(url.scheme in ('http','https') and url.hostname and not url.username and not url.password,'Invalid selected browser URL')
        key=(source['kind'],source['id'].casefold());fail(key not in seen,'Duplicate selected source');seen.add(key);size+=len(source['text'].encode('utf-16-le'))//2
    fail(size<=80000,'Selected source text is too large')

def validate_composio(state):
    """Only disabled, public connection bindings may cross the recovery boundary."""
    identity=lambda value:isinstance(value,str) and re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',value,re.I)
    identifier=lambda value:isinstance(value,str) and re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}',value)
    scheme=lambda value:isinstance(value,str) and re.fullmatch(r'[A-Z][A-Z0-9_]{0,59}',value)
    fail(isinstance(state,dict) and set(state)=={'namespace','connections','configurations'} and identity(state['namespace']) and isinstance(state['connections'],list) and len(state['connections'])<=500 and isinstance(state['configurations'],dict) and len(state['configurations'])<=1000 and len(json.dumps(state,ensure_ascii=False,separators=(',',':')).encode('utf-16-le'))//2<=2000000,'Invalid Composio connection metadata')
    ids=set();accounts=set()
    for row in state['connections']:
        fail(isinstance(row,dict) and set(row)<={'id','toolkit','name','scheme','authConfigId','accountId','status','enabled','agents','expiresAt'} and {'id','toolkit','name','scheme','authConfigId','accountId','status','enabled','agents'}<=set(row),'Invalid Composio connection fields')
        fail(identity(row['id']) and row['id'].casefold() not in ids and isinstance(row['name'],str) and row['name'].strip() and len(row['name'].encode('utf-16-le'))//2<=100 and not re.search(r'[\x00-\x1f\x7f]',row['name']) and identifier(row['toolkit']) and scheme(row['scheme']) and identifier(row['authConfigId']) and identifier(row['accountId']) and row['accountId']!='instant_account' and row['accountId'] not in accounts,'Invalid or duplicate Composio connection metadata');ids.add(row['id'].casefold());accounts.add(row['accountId'])
        fail(row['enabled'] is False and row['status'] in ('CANCELLED','DISCONNECTED','DISCONNECTING','NEEDS_VERIFICATION'),'Portable Composio connections must require verification')
        agents=row['agents'];fail(agents is None or isinstance(agents,list) and len(agents)<=500 and all(identity(agent) for agent in agents) and len({agent.casefold() for agent in agents})==len(agents),'Invalid Composio agent assignments')
        if 'expiresAt' in row:
            from datetime import datetime
            fail(isinstance(row['expiresAt'],str) and len(row['expiresAt'])<=100,'Invalid Composio connection expiry')
            try:datetime.fromisoformat(row['expiresAt'].replace('Z','+00:00'))
            except ValueError:raise ValueError('Invalid Composio connection expiry') from None
    for key,value in state['configurations'].items():
        pair=key.split(':');fail(len(pair)==2 and identifier(pair[0]) and scheme(pair[1]) and identifier(value),'Invalid Composio authentication metadata')

def validate_google_documents(journal):
    from datetime import datetime
    fail(isinstance(journal,dict) and set(journal)=={'format','operations'} and type(journal['format']) is int and journal['format']==1 and isinstance(journal['operations'],list) and len(journal['operations'])<=500 and len(json.dumps(journal,ensure_ascii=False).encode('utf-16-le'))//2<=2000000,'Invalid saved Google document operations')
    ids=set();keys=set();fields={'id','binding','connectionId','referenceId','relative','name','sha256','bytes','extension','phase','createdAt','updatedAt','cloudId'}
    def identity(value):return isinstance(value,str) and bool(re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',value,re.I))
    def text(value,limit):return isinstance(value,str) and len(value.encode('utf-16-le'))//2<=limit
    for row in journal['operations']:
        fail(isinstance(row,dict) and set(row)<=fields and fields-{'cloudId'}<=set(row),'Invalid saved Google document fields')
        fail(all(identity(row[name]) for name in ('id','connectionId','referenceId')) and row['id'] not in ids and all(isinstance(row[name],str) and re.fullmatch(r'[a-f0-9]{64}',row[name]) for name in ('binding','sha256')),'Invalid saved Google document identity')
        fail(text(row['relative'],500) and not re.search(r'[:\\\x00-\x1f\x7f]',row['relative']) and not row['relative'].startswith('/') and not any(part in ('.','..') for part in row['relative'].split('/')) and text(row['name'],255) and row['name'].strip() and not re.search(r'[\\/\x00-\x1f\x7f]',row['name']),'Invalid saved Google document path')
        fail(type(row['bytes']) is int and 1<=row['bytes']<=20*1024**2 and row['extension'] in ('.docx','.xlsx','.pptx') and row['name'].lower().endswith(row['extension']) and row['phase'] in ('preparing','creating','held','completed','retryable'),'Invalid saved Google document status')
        fail(('cloudId' not in row or isinstance(row['cloudId'],str) and re.fullmatch(r'[a-zA-Z0-9_-]{1,200}',row['cloudId'])) and (row['phase']!='completed' or 'cloudId' in row),'Invalid saved Google document identifier')
        for name in ('createdAt','updatedAt'):
            fail(isinstance(row[name],str),'Invalid saved Google document timestamp')
            try:datetime.fromisoformat(row[name].replace('Z','+00:00'))
            except ValueError:raise ValueError('Invalid saved Google document timestamp') from None
        key=(row['binding'],row['referenceId'],row['relative'],row['sha256']);fail(key not in keys,'Duplicate saved Google document operation');keys.add(key);ids.add(row['id'])

def validate_settings(record,owners,database_sha):
    fail(isinstance(record,dict) and set(record)=={'format','kind','databaseManifestSha256','accounts','indexSha256'} and record['format']==1 and record['kind']=='sylvana-portable-settings' and record['databaseManifestSha256']==database_sha and isinstance(record['accounts'],list),'Invalid portable settings record')
    base={key:record[key] for key in ('format','kind','databaseManifestSha256','accounts')}
    fail(hashlib.sha256(json_with_js_strings(base).encode()).hexdigest()==record['indexSha256'] and len(json_with_js_strings(record).encode())<=64*1024**2,'Portable settings record changed')
    found=set();allowed={'preferences','model-choices','prefer-chatgpt','composer','chat-drafts','desktop-location','voice-preferences','notification-preferences','composio-state','google-documents','agent-editor-drafts'}
    for account in record['accounts']:
        fail(isinstance(account,dict) and set(account)=={'owner','settings'} and account['owner'] in owners and account['owner'] not in found and isinstance(account['settings'],dict) and set(account['settings'])<=allowed,'Invalid portable settings account or fields');found.add(account['owner'])
        if 'composio-state' in account['settings']:validate_composio(account['settings']['composio-state'])
        if 'google-documents' in account['settings']:validate_google_documents(account['settings']['google-documents'])
        if 'agent-editor-drafts' in account['settings']:validate_editor_drafts(account['settings']['agent-editor-drafts'],account['owner'])
        for value in [account['settings'].get('composer',{}),*[draft.get('options',{}) for draft in account['settings'].get('chat-drafts',{}).values()]]:
            if 'sources' in value:validate_selected_sources(value['sources'],account['owner'])
        if 'notification-preferences' in account['settings']:
            preferences=account['settings']['notification-preferences'];legacy=isinstance(preferences,dict) and set(preferences)=={'responses','tasks'} and all(type(value) is bool for value in preferences.values());modern=isinstance(preferences,dict) and set(preferences)=={'completion','permissions','questions','tasks'} and preferences['completion'] in ('never','unfocused','always') and all(type(preferences[key]) is bool for key in ('permissions','questions','tasks'));fail(legacy or modern,'Invalid portable notification settings')
    fail(found==owners,'Portable settings owners differ from the database snapshot')

def validate_editor_drafts(rows,owner):
    fail(isinstance(rows,dict) and utf16_length(json_with_js_strings(rows))<=8000000,'Invalid or oversized agent editor drafts');active=0
    editor_uuid=r'[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}'
    fail(isinstance(owner,str) and re.fullmatch(editor_uuid,owner),'Invalid saved-draft owner')
    for scope,row in rows.items():
        match=re.fullmatch(r'(preview|builder|editor):(new|'+editor_uuid+r')(?::('+editor_uuid+r'))?',scope)
        fail(match and (match[3] is None or match[1] in ('preview','builder') and match[2]=='new'),'Invalid saved creation preview location')
        fail(match and isinstance(row,dict) and set(row)=={'version','owner','scope','revision','writeId','payload','updatedAt'} and type(row['version']) is int and row['version']==1 and row['owner']==owner and row['scope']==scope and type(row['revision']) is int and 1<=row['revision']<=9007199254740991 and isinstance(row['writeId'],str) and re.fullmatch(editor_uuid,row['writeId'],re.I) and editor_timestamp(row['updatedAt']),'Invalid or foreign saved agent draft')
        payload=row['payload']
        if payload is None:continue
        active+=1;fail(active<=100,'Too many active saved agent drafts')
        fail(isinstance(payload,str) and utf16_length(payload)<=4000000 and '\x00' not in payload,'Invalid agent draft text')
        value=json.loads(payload);source=None if match[2]=='new' else match[2];creation=match[3]
        fail(isinstance(value,dict) and type(value.get('version')) is int and value.get('version')==(2 if creation else 1) and value.get('creationId')==creation and value.get('owner')==owner and value.get('source')==source,'Saved agent draft changed account or source')
        if match[1]=='editor':fail(set(value)=={'version','owner','source','form'} and isinstance(value['form'],dict),'Invalid saved editor form')
        else:
            fields={'version','owner','source','sessionId','prompt','thinking','execution','pending'}|({'creationId'} if creation else set())
            fail(set(value) in (fields,fields|{'builderAppliedIds'}) if match[1]=='builder' else set(value)==fields,'Invalid saved preview composer fields')
            fail(isinstance(value['sessionId'],str) and re.fullmatch(editor_uuid,value['sessionId'],re.I) and isinstance(value['prompt'],str) and utf16_length(value['prompt'])<=100000 and value['thinking'] in ('default','none','minimal','low','medium','high','xhigh','max','ultra') and isinstance(value['execution'],dict),'Invalid saved preview composer')
            if 'builderAppliedIds' in value:
                receipts=value['builderAppliedIds']
                fail(isinstance(receipts,list) and len(receipts)<=1000 and all(isinstance(receipt,str) and re.fullmatch(editor_uuid,receipt) for receipt in receipts) and len(set(receipts))==len(receipts),'Invalid saved builder application receipts')
            if value['execution'].get('sources'):validate_selected_sources(value['execution']['sources'],owner)
            pending=value['pending']
            if pending is not None:fail(isinstance(pending,dict) and pending.get('sessionId')==value['sessionId'] and pending.get('sourceAgentId')==source and ((isinstance(pending.get('creationId'),str) and pending['creationId'].lower()==creation) if creation else 'creationId' not in pending) and isinstance(pending.get('requestId'),str) and UUID.fullmatch(pending['requestId']),'Saved preview request changed scope')


def validate_clipboard(record,owners,database):
    fail(record.get('format')==1 and brand_kind(record.get('kind'))=='sylvana-portable-clipboard' and isinstance(record.get('accounts'),list),'Invalid portable clipboard record')
    inventory(record['manifest']);base={name:record[name] for name in ('format','kind','accounts','manifest','archiveSha256')}
    fail(hashlib.sha256(json.dumps(base,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==record.get('indexSha256'),'Portable clipboard record changed')
    fail(set(database.get('accountIds',[]))==owners and len(database['accountIds'])==len(owners),'Portable clipboard owners must match the database snapshot')
    found=set();files=set();directories=set()
    for account in record['accounts']:
        owner=account['owner'];fail(owner in owners and owner not in found and isinstance(account.get('references'),list) and len(account['references'])<=100,'Invalid portable clipboard owner');found.add(owner);ids=set();size=0
        for ref in account['references']:
            fail(isinstance(ref.get('id'),str) and re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',ref['id'],re.I) and ref['id'].casefold() not in ids,'Invalid clipboard identity');ids.add(ref['id'].casefold());name=owner+'/'+ref['id']+'.image';row=record['manifest']['files'].get(name)
            fail(ref.get('relativePath')==name and isinstance(ref.get('name'),str) and ref['name'].strip() and len(ref['name'].encode('utf-16-le'))//2<=240 and not re.search(r'[\x00-\x1f\x7f]',ref['name']) and isinstance(ref.get('bytes'),int) and 0<ref['bytes']<=20*1024**2 and row and row['bytes']==ref['bytes'],'Invalid or foreign clipboard reference');size+=ref['bytes'];files.add(name);directories.add(owner)
        fail(size<=40*1024**2,'Clipboard recovery exceeds the per-account limit')
    fail(found==owners and set(record['manifest']['files'])==files and len(record['manifest']['directories'])==len(directories) and set(record['manifest']['directories'])==directories,'Clipboard recovery inventory contains unowned entries')

def selected_profile_entry(name):
    parts=name.split('/')
    if parts[0]=='editor-draft-journals':return len(parts)==1 or len(parts)==2 and re.fullmatch('[0-9]{16}-[a-f0-9]{64}\\.json',parts[1]) is not None
    if parts[0]=='draft-previews':return len(parts)==1 or parts[1] in ('codex','workspaces') and selected_profile_entry('/'.join(parts[1:]))
    if parts[0] not in ('codex','workspaces','attachments','chrome-tools'):return False
    if parts[0]=='chrome-tools':return len(parts)==1 or UUID.fullmatch(parts[1]) and (len(parts)==2 or parts[2]=='artifacts')
    if parts[0]=='codex' and len(parts)>=5:
        inner=parts[4:]
        if inner[0] in ('auth.json','config.toml','.sandbox','.sandbox_migration','cap_sid','tmp','.tmp'):return False
        if inner[:2]==['skills','.system']:return False
    return True

def reserve(directory,headroom):fail(shutil.disk_usage(directory).free>headroom+128*1024,'Recovery reached its reserved disk-space limit')

@contextmanager
def recovery_lock(home):
    folder=home/'.sylvana';folder.mkdir(exist_ok=True);no_links(folder,True);lock=folder/'recovery.lock';no_links(lock)
    with lock.open('a+b') as stream:
        if stream.tell()==0:stream.write(b'0');stream.flush()
        stream.seek(0)
        if os.name=='nt':
            import msvcrt
            msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
        else:
            import fcntl
            fcntl.flock(stream.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        try:yield
        finally:
            stream.seek(0)
            if os.name=='nt':msvcrt.locking(stream.fileno(),msvcrt.LK_UNLCK,1)
            else:fcntl.flock(stream.fileno(),fcntl.LOCK_UN)

def copy_verified(source,target,row,container,headroom):
    no_links(target)
    if target.exists():fail(target.is_file() and target.stat().st_size==row['bytes'] and digest(target)==row['sha256'],'Interrupted recovery contains a changed file');return
    parts=container/'.sylvana-recovery-parts';parts.mkdir(exist_ok=True);no_links(parts,True)
    pending=parts/(hashlib.sha256(str(target.relative_to(container)).encode()).hexdigest()+'.part');no_links(pending)
    offset=0
    if pending.exists():
        offset=pending.stat().st_size;fail(offset<=row['bytes'],'Incomplete recovery file is oversized');prefix=hashlib.sha256();remaining=offset
        while remaining:
            block=source.read(min(remaining,64*1024));fail(block,'Incomplete recovery source ended early');prefix.update(block);remaining-=len(block)
        fail(digest(pending)==prefix.hexdigest(),'Incomplete recovery file changed; preserve it for inspection')
    with pending.open('ab' if pending.exists() else 'xb') as output:
        for data in iter(lambda:source.read(64*1024),b''):reserve(container,headroom);output.write(data)
        output.flush();os.fsync(output.fileno())
    fail(pending.stat().st_size==row['bytes'] and digest(pending)==row['sha256'],'Restored file failed its fingerprint check');reserve(container,headroom)
    fail(not target.exists(),'A recovery destination appeared during copying');pending.rename(target)

def copy_archive(archive,manifest,destination,headroom,select=lambda _:True):
    destination.mkdir(parents=True,exist_ok=True);no_links(destination,True)
    for name in manifest['directories']:
        if select(name):destination.joinpath(*safe_name(name)).mkdir(parents=True,exist_ok=True)
    with tarfile.open(archive,'r:gz') as tar:
        for member in tar:
            name=member.name.rstrip('/')
            if not member.isfile() or not select(name):continue
            row=manifest['files'][name];target=destination.joinpath(*safe_name(name))
            with tar.extractfile(member) as source:copy_verified(source,target,row,destination,headroom)
    parts=destination/'.sylvana-recovery-parts'
    if parts.exists():parts.rmdir() # Only an empty directory owned by this operation.

def native_fingerprints(profile,source_profile):
    spec=importlib.util.spec_from_file_location('sylvana_native_relocation',Path(__file__).with_name('relocate-native-profile.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    records={}
    for database in sorted([*(profile/'codex').glob('*/*/*/state_5.sqlite'),*(profile/'draft-previews/codex').glob('*/*/*/state_5.sqlite')]):
        no_links(database,True);connection=sqlite3.connect('file:'+str(database)+'?mode=ro',uri=True)
        try:
            fail(connection.execute('PRAGMA integrity_check').fetchone()==('ok',),'Native history index failed its integrity check');tables={}
            for (table,sql) in connection.execute("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name"):
                escaped='"'+table.replace('"','""')+'"';columns=[r[1] for r in connection.execute('PRAGMA table_info('+escaped+')')];rows=[]
                for values in connection.execute('SELECT * FROM '+escaped):
                    values=list(values)
                    if table=='threads':
                        for column in ('rollout_path','cwd','agent_path'):
                            if column in columns:
                                pos=columns.index(column);values[pos]=module.mapped(values[pos],Path(source_profile),profile)
                    rows.append(json.dumps([{'bytes':base64.b64encode(v).decode()} if isinstance(v,bytes) else v for v in values],ensure_ascii=False,separators=(',',':')))
                tables[table]={'columns':columns,'rows':len(rows),'sha256':hashlib.sha256(('\n'.join(sorted(rows))).encode()).hexdigest(),'schema':sql}
            records[database.relative_to(profile).as_posix()]=tables
        finally:connection.close()
    return records

def inspect_environment(home,appdata,registered,app_running=False):
    home=no_links(home,True);appdata=no_links(appdata)
    fail(home.is_dir() and appdata.is_relative_to(home),'Recovery must target a fresh home and its own application data')
    fail(not app_running,'Close Sylvana before preparing recovery')
    fail(not any(re.match(r'^SylvanaRuntime(?:-|$)',name.strip(),re.I) for name in registered),'An existing Sylvana runtime was found; preserve it and use a fresh Windows account')
    private=home/'.sylvana/desktop';fail(not any((private/name).exists() for name in ('profile','profile-location.json','migration.lock')),'An existing private profile or migration was found')
    if not (home/'.sylvana/recovery-state.json').exists():fail(not (appdata/'Sylvana').exists() and not (home/'Sylvana Files').exists(),'Existing profile or public outputs must be preserved before recovery')
    return home,appdata

def prepare(root,home,appdata,registered,app_running=False,headroom=512*1024**2,compress=False,phase_hook=lambda _:None,windows_sid=None):
    home,appdata=inspect_environment(home,appdata,registered,app_running)
    bundle=validate_bundle(root)
    identity=current_windows_sid() if bundle.get('windows') and windows_sid is None else windows_sid
    with recovery_lock(home):return prepare_locked(bundle,home,appdata,headroom,compress,phase_hook,identity)

def prepare_locked(bundle,home,appdata,headroom,compress,phase_hook,windows_sid=None):
    profile=appdata/'Sylvana';public=home/'Sylvana Files';private=home/'.sylvana/desktop'
    workspace=bundle.get('workspace');workspace_required=None
    if workspace:workspace_required={'format':1,'indexSha256':workspace['indexSha256'],'descriptorSha256':bundle['descriptor']['workspaceManifest']['sha256'],'archiveSha256':bundle['descriptor']['workspaceArchive']['sha256'],'databaseManifestSha256':bundle['descriptor']['databaseManifest']['sha256'],'owners':bundle['database']['accountIds']}
    def verify_workspace(destination):
        if not workspace:return
        fail(load(destination/'.sylvana-workspaces-required.json')==workspace_required,'Required workspace recovery binding changed')
        for name,key in [('workspace-data.json','descriptorSha256'),('workspace-data.tar.gz','archiveSha256')]:fail(digest(no_links(destination/'restored-workspaces'/name,True))==workspace_required[key],'Staged workspace recovery bytes changed')
    fail(not any((private/name).exists() for name in ('profile','profile-location.json','migration.lock')),'An existing private profile or migration was found')
    journal=home/'.sylvana/recovery-state.json';state=load(journal) if journal.exists() else None
    windows=bundle.get('windows');import_windows=bool(windows and windows['windowsSid']==windows_sid)
    def verify_windows(destination):
        if not windows:return
        fail(digest(no_links(destination/'.sylvana-windows-profile.json',True))==bundle['descriptor']['windowsProfileManifest']['sha256'],'The restored Windows credential manifest changed')
        fail(load(destination/'.sylvana-windows-credentials.json')=={'format':1,'manifest':windows,'imported':import_windows},'Windows credential recovery choice changed')
        if import_windows:
            fail(digest(no_links(destination/'credentials.bin',True))==windows['files']['credentials.bin']['sha256'] and windows_encryption_key(load(destination/'Local State',32*1024**2))==windows['encryptionKeySha256'],'Recovered Windows credentials or their key changed')
        else:fail(not (destination/'credentials.bin').exists() and not (destination/'Local State').exists(),'Credentials cannot be imported under another Windows account')
    if state:
        fail(state.get('format')==2 and state.get('descriptorSha256')==bundle['descriptorSha256'] and state.get('profile')==str(profile) and state.get('publicRoot')==str(public),'A different recovery operation already owns this home')
        fail(UUID.fullmatch(state['operationId']),'Invalid recovery operation identity')
        if windows:fail(state.get('windowsCredentialsImported')==import_windows,'The Windows account changed during recovery')
        if state['status']=='prepared':
            marker={'format':2,'operationId':state['operationId'],'descriptorSha256':bundle['descriptorSha256']}
            fail(load(profile/'.sylvana-recovery-operation.json')==marker and load(home/'.sylvana/public-output-recovery-operation.json')==marker,'Prepared recovery ownership changed')
            if bundle['clipboard']:fail(load(profile/'restored-clipboard-images.json')==bundle['clipboard'] and load(profile/'.sylvana-clipboard-required.json')=={'format':1,'indexSha256':bundle['clipboard']['indexSha256']},'Prepared clipboard recovery changed')
            if bundle['settings']:fail(load(profile/'restored-settings.json')==bundle['settings'] and load(profile/'.sylvana-settings-required.json')=={'format':1,'indexSha256':bundle['settings']['indexSha256']},'Prepared settings recovery changed')
            if bundle['external']:fail(load(profile/'restored-external.json')==bundle['external'] and load(profile/'.sylvana-external-required.json')=={'format':1,'indexSha256':bundle['external']['indexSha256']},'Prepared external recovery changed')
            if bundle['layouts']:
                fail(load(profile/'restored-layouts.json')==bundle['layouts'] and load(profile/'.sylvana-layouts-required.json')=={'format':1,'indexSha256':bundle['layouts']['indexSha256']},'Prepared workspace layout recovery changed')
                if bundle['layouts']['window'] is not None:fail(load(profile/'window.json')==bundle['layouts']['window'],'Prepared window geometry changed')
            verify_workspace(profile)
            verify_windows(profile)
            return state
    else:
        fail(not profile.exists() and not public.exists(),'Existing profile or public outputs must be preserved before recovery')
        state={'format':2,'operationId':str(uuid.uuid4()),'descriptorSha256':bundle['descriptorSha256'],'profile':str(profile),'publicRoot':str(public),'status':'preparing','phase':'validating'}
        if windows:state.update(windowsCredentialsImported=import_windows,windowsCredentialsManifestSha256=bundle['descriptor']['windowsProfileManifest']['sha256'])
        journal.parent.mkdir(parents=True,exist_ok=True);save(journal,state)
    stage=home/'.sylvana/recovery-staging'/state['operationId'];state['stage']=str(stage)
    def phase(name):state.update(status='preparing',phase=name);save(journal,state);phase_hook(name)
    try:
        stage.mkdir(parents=True,exist_ok=True);no_links(stage,True);reserve(home,headroom)
        if compress:
            fail(os.name=='nt','NTFS-compressed recovery requires Windows');result=subprocess.run(['compact.exe','/C','/I','/Q',str(stage)],capture_output=True);fail(result.returncode==0,'Recovery staging compression failed')
        staged_profile=stage/'profile';staged_public=stage/'Sylvana Files';owner_record={'format':2,'operationId':state['operationId'],'descriptorSha256':bundle['descriptorSha256']}
        def owned(destination):
            return destination.exists() and load(destination/'.sylvana-recovery-operation.json')==owner_record
        if profile.exists():fail(owned(profile),'An unrelated profile appeared during recovery')
        public_owner=home/'.sylvana/public-output-recovery-operation.json'
        if public.exists():fail(public_owner.exists() and load(public_owner)==owner_record,'Unrelated public outputs appeared during recovery')
        if not profile.exists():
            phase('staging-profile');copy_archive(bundle['profileArchive'],bundle['profile']['manifest'],staged_profile,headroom,selected_profile_entry)
            migration=staged_profile/'migration-input';migration.mkdir(exist_ok=True)
            for row in bundle['database']['files']:
                source=bundle['databasePath'].parent/row['name'];target=migration/row['name'];reserve(home,headroom)
                with source.open('rb') as src:copy_verified(src,target,{'bytes':source.stat().st_size,'sha256':row['sha256']},staged_profile,headroom)
            target=migration/'manifest.json'
            if target.exists():fail(digest(target)==digest(bundle['databasePath']),'Staged database manifest changed')
            else:shutil.copyfile(bundle['databasePath'],target)
            parts=staged_profile/'.sylvana-recovery-parts'
            if parts.exists():parts.rmdir()
            if bundle['clipboard']:
                phase('staging-clipboard');copy_archive(bundle['clipboardArchive'],bundle['clipboard']['manifest'],staged_profile/'restored-clipboard',headroom)
                save(staged_profile/'restored-clipboard-images.json',bundle['clipboard']);save(staged_profile/'.sylvana-clipboard-required.json',{'format':1,'indexSha256':bundle['clipboard']['indexSha256']});state['clipboardIndexSha256']=bundle['clipboard']['indexSha256']
            if bundle['settings']:
                phase('staging-settings');save_compact_settings(staged_profile/'restored-settings.json',bundle['settings']);save(staged_profile/'.sylvana-settings-required.json',{'format':1,'indexSha256':bundle['settings']['indexSha256']});state['settingsIndexSha256']=bundle['settings']['indexSha256']
            if windows:
                phase('staging-windows-credentials')
                source=resource(bundle['root'],bundle['descriptor']['windowsProfileManifest'])
                with source.open('rb') as stream:copy_verified(stream,staged_profile/'.sylvana-windows-profile.json',{'bytes':source.stat().st_size,'sha256':bundle['descriptor']['windowsProfileManifest']['sha256']},staged_profile,headroom)
                if import_windows:
                    for name,row in windows['files'].items():
                        with (bundle['root']/'windows-profile'/name).open('rb') as stream:copy_verified(stream,staged_profile/name,row,staged_profile,headroom)
                save(staged_profile/'.sylvana-windows-credentials.json',{'format':1,'manifest':windows,'imported':import_windows})
            if bundle['external']:
                save(staged_profile/'restored-external.json',bundle['external']);save(staged_profile/'.sylvana-external-required.json',{'format':1,'indexSha256':bundle['external']['indexSha256']});state['externalIndexSha256']=bundle['external']['indexSha256']
            if bundle['layouts']:
                phase('staging-layouts');save(staged_profile/'restored-layouts.json',bundle['layouts']);save(staged_profile/'.sylvana-layouts-required.json',{'format':1,'indexSha256':bundle['layouts']['indexSha256']});state['layoutsIndexSha256']=bundle['layouts']['indexSha256']
                if bundle['layouts']['window'] is not None:save(staged_profile/'window.json',bundle['layouts']['window'])
            if workspace:
                phase('staging-workspaces');workspace_stage=staged_profile/'restored-workspaces';workspace_stage.mkdir(exist_ok=True)
                for source,name in [(bundle['workspacePath'],'workspace-data.json'),(bundle['workspaceArchive'],'workspace-data.tar.gz')]:
                    with source.open('rb') as stream:copy_verified(stream,workspace_stage/name,{'bytes':source.stat().st_size,'sha256':digest(source)},staged_profile,headroom)
                save(staged_profile/'.sylvana-workspaces-required.json',workspace_required);state['workspaceIndexSha256']=workspace['indexSha256']
            save(staged_profile/'restored-public-files.json',bundle['references']);save(staged_profile/'.sylvana-recovery-operation.json',owner_record)
        if not public.exists():
            phase('staging-public');copy_archive(bundle['publicArchive'],bundle['public']['manifest'],staged_public,headroom)
            if bundle['external']:
                phase('staging-external');copy_archive(bundle['externalArchive'],bundle['external']['manifest'],staged_public,headroom)
            save(public_owner,owner_record)
        phase('publishing-files');appdata.mkdir(parents=True,exist_ok=True)
        if not profile.exists():staged_profile.rename(profile)
        if not public.exists():staged_public.rename(public)
        phase('rebasing-native-histories')
        before_file=stage/'native-record-fingerprints.json'
        if before_file.exists():before=load(before_file)
        else:before=native_fingerprints(profile,bundle['references']['index']['sourceProfile']);save(before_file,before)
        marker=profile/'.sylvana-native-relocation.json'
        if not marker.exists():save(marker,{'format':1,'codex':'0.163.0','sourceProfile':bundle['references']['index']['sourceProfile'],'destinationProfile':str(profile),'state':'copied'})
        spec=importlib.util.spec_from_file_location('sylvana_native_relocation',Path(__file__).with_name('relocate-native-profile.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);native=module.repair(profile)
        fail(native_fingerprints(profile,bundle['references']['index']['sourceProfile'])==before,'Native history records changed beyond the verified path translation')
        phase('verifying-published-files')
        for name,row in bundle['profile']['manifest']['files'].items():
            if not selected_profile_entry(name) or re.search(r'/state_5\.sqlite(?:-wal|-shm)?$',name):continue
            target=profile.joinpath(*safe_name(name));no_links(target,True);fail(digest(target)==row['sha256'],'Published native or workspace data changed')
        for name,row in bundle['public']['manifest']['files'].items():fail(digest(public.joinpath(*safe_name(name)))==row['sha256'],'Published public output changed')
        if bundle['clipboard']:
            for name,row in bundle['clipboard']['manifest']['files'].items():fail(digest(profile/'restored-clipboard'/name)==row['sha256'],'Published portable clipboard image changed')
            fail(load(profile/'restored-clipboard-images.json')==bundle['clipboard'] and load(profile/'.sylvana-clipboard-required.json')=={'format':1,'indexSha256':bundle['clipboard']['indexSha256']},'Published clipboard recovery metadata changed');state['clipboardIndexSha256']=bundle['clipboard']['indexSha256']
        if bundle['settings']:
            fail(load(profile/'restored-settings.json')==bundle['settings'] and load(profile/'.sylvana-settings-required.json')=={'format':1,'indexSha256':bundle['settings']['indexSha256']},'Published settings recovery metadata changed');state['settingsIndexSha256']=bundle['settings']['indexSha256']
        if bundle['external']:
            for name,row in bundle['external']['manifest']['files'].items():fail(digest(public.joinpath(*safe_name(name)))==row['sha256'],'Published external bytes changed')
            fail(load(profile/'restored-external.json')==bundle['external'] and load(profile/'.sylvana-external-required.json')=={'format':1,'indexSha256':bundle['external']['indexSha256']},'Published external recovery metadata changed');state['externalIndexSha256']=bundle['external']['indexSha256']
        if bundle['layouts']:
            fail(load(profile/'restored-layouts.json')==bundle['layouts'] and load(profile/'.sylvana-layouts-required.json')=={'format':1,'indexSha256':bundle['layouts']['indexSha256']},'Published layout recovery metadata changed');state['layoutsIndexSha256']=bundle['layouts']['indexSha256']
            if bundle['layouts']['window'] is not None:fail(load(profile/'window.json')==bundle['layouts']['window'],'Published window geometry changed')
        verify_workspace(profile)
        verify_windows(profile)
        if workspace:state['workspaceIndexSha256']=workspace['indexSha256']
        reserve(home,headroom);state.update(status='prepared',phase='prepared',native=native,providerCredentialsImported=import_windows,providerReauthorizationRequired=not import_windows,databaseImported=False,fullApplicationRestoreProven=False)
        save(journal,state);return state
    except BaseException as error:
        state.update(status='interrupted',error=type(error).__name__+': '+str(error));save(journal,state);raise

def bootstrap_family(processes,bootstrap_pid,parent_pid,expected_executable):
    if bootstrap_pid is None:return set()
    fail(bootstrap_pid==parent_pid,'The recovery bootstrap must be this helper\'s actual parent')
    parent=next((p for p in processes if p['ProcessId']==bootstrap_pid),None)
    fail(parent and parent['Name'].casefold()=='sylvana.exe' and parent.get('ExecutablePath') and ntpath.normcase(ntpath.normpath(parent['ExecutablePath']))==ntpath.normcase(ntpath.normpath(str(expected_executable))),'The recovery bootstrap executable could not be verified')
    allowed={bootstrap_pid}
    while True:
        added={p['ProcessId'] for p in processes if p['ParentProcessId'] in allowed and p['Name'].casefold()=='sylvana.exe'}-allowed
        if not added:return allowed
        allowed.update(added)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('bundle',type=Path);parser.add_argument('--check-only',action='store_true');parser.add_argument('--compress-staging',action='store_true');parser.add_argument('--bootstrap-pid',type=int);args=parser.parse_args()
    fail(os.name=='nt','This desktop recovery command requires Windows');home=Path.home();appdata=Path(os.environ['APPDATA'])
    names=subprocess.check_output(['wsl.exe','--list','--quiet']);registered=(names.decode('utf-16le') if b'\x00' in names else names.decode('utf-8')).lstrip('\ufeff').splitlines()
    query="$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process|Where-Object {$_.Name -in @('Sylvana.exe','SylvanaSetup.exe')}|Select-Object ProcessId,ParentProcessId,Name,ExecutablePath)"
    processes=json.loads(subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-Command',query],encoding='utf-8-sig'))
    allowed=bootstrap_family(processes,args.bootstrap_pid,os.getppid(),Path(__file__).resolve().parents[3]/'Sylvana.exe')
    running=any(p['ProcessId'] not in allowed for p in processes)
    if args.check_only:
        inspect_environment(home,appdata,registered,running);validate_bundle(args.bundle)
        print(json.dumps({'success':True,'checkOnly':True,'destinationEligible':True,'resumeRequiresContentVerification':(home/'.sylvana/recovery-state.json').exists(),'productionWrites':0}));return
    result=prepare(args.bundle,home,appdata,registered,running,compress=args.compress_staging);print(json.dumps({'success':True,'status':result['status'],'native':result['native'],'providerRequests':0,'databaseImported':False}))

if __name__=='__main__':main()
