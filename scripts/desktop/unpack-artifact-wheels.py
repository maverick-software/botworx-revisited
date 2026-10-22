"""Unpack already hash-verified binary wheels without running installation hooks."""
import hashlib,json,re,stat,sys,zipfile
from pathlib import Path

pins_path,cache,stage,bootstrap=map(Path,sys.argv[1:]);pins=json.loads(pins_path.read_text());assert pins['format']==1 and pins['platform']=='win_amd64'
stage.mkdir(exist_ok=False);seen=set();files={};total=0
for wheel in pins['wheels']:
    archive=cache/wheel['file'];assert archive.name==wheel['file'] and archive.suffix=='.whl'
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==wheel['sha256']
    with zipfile.ZipFile(archive) as package:
        assert len(package.infolist())<20000
        for entry in package.infolist():
            if entry.is_dir():continue
            name=entry.filename;parts=tuple(name.split('/'))
            assert name and not name.startswith('/') and '\\' not in name and parts and all(part not in ['', '.', '..'] and not re.search(r'[<>:"|?*\x00-\x1f]',part) and not part.endswith(('.', ' ')) and not re.match(r'(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])([.]|$)',part) for part in parts)
            # Preserve helper script source in its wheel layout. It is never
            # relocated into Scripts, added to PATH or executed by preparation.
            if any(part.endswith('.data') for part in parts):
                assert parts[0].endswith('.data') and len(parts)>=3 and parts[1]=='scripts','Unsupported wheel data installation layout'
            assert not name.endswith('.pth'),'Automatic Python startup hooks are not bundled'
            assert stat.S_IFMT(entry.external_attr>>16)!=stat.S_IFLNK
            assert name.lower() not in seen,'Overlapping package path: '+name
            seen.add(name.lower());total+=entry.file_size;assert total<250*1024*1024
            data=package.read(entry);target=stage.joinpath(*parts);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
            files[name]=hashlib.sha256(data).hexdigest()
for wheel in pins['wheels']:
    distribution=wheel['file'].split('-')[0].lower()
    assert any(name.lower().startswith(distribution+'-'+wheel['version'].lower()+'.dist-info/') and any(word in name.lower() for word in ['license','licence','copying']) for name in files),'Missing license notice: '+wheel['name']
bootstrap_data=bootstrap.read_bytes();(stage/'bootstrap').mkdir();(stage/'bootstrap/sitecustomize.py').write_bytes(bootstrap_data);files['bootstrap/sitecustomize.py']=hashlib.sha256(bootstrap_data).hexdigest()
manifest={'format':1,'pinsSha256':hashlib.sha256(pins_path.read_bytes()).hexdigest(),'python':pins['python'],'platform':pins['platform'],'directory':pins['directory'],'modules':pins['modules'],'wheels':[{key:wheel[key] for key in ['name','version','file','sha256']} for wheel in pins['wheels']],'files':dict(sorted(files.items()))}
(stage.parent/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print(json.dumps({'files':len(files),'bytes':total,'wheels':len(pins['wheels'])}))
