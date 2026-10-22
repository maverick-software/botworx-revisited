"""Independently compare an Office edit against its inputs, including hidden parts."""
from pathlib import Path
import hashlib,json,posixpath,sys,zipfile,xml.etree.ElementTree as E

S='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
P='http://schemas.openxmlformats.org/presentationml/2006/main'
A='http://schemas.openxmlformats.org/drawingml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG='http://schemas.openxmlformats.org/package/2006/relationships'

def package(path):
    with zipfile.ZipFile(path) as archive:
        names=archive.namelist()
        assert len(names)==len(set(names)) and sum(i.file_size for i in archive.infolist())<50*1024**2
        assert all(not n.startswith('/') and '..' not in n.split('/') for n in names)
        return {n:archive.read(n) for n in names if not n.endswith('/')}

def logical(node):
    # Prefix spelling and XML indentation are serialization choices. Text and attributes remain exact.
    text=node.text if node.text and (not len(node) or node.text.strip()) else None
    tail=node.tail if node.tail and node.tail.strip() else None
    return (node.tag,tuple(sorted(node.attrib.items())),text,tuple(logical(c) for c in node),tail)

def first_part(parts,kind):
    if kind=='xlsx':
        main='xl/workbook.xml';rel='xl/_rels/workbook.xml.rels';node=E.fromstring(parts[main]).find('{'+S+'}sheets')[0]
    else:
        main='ppt/presentation.xml';rel='ppt/_rels/presentation.xml.rels';node=E.fromstring(parts[main]).find('{'+P+'}sldIdLst')[0]
    rid=node.attrib['{'+R+'}id'];target=next(r.attrib['Target'] for r in E.fromstring(parts[rel]) if r.attrib['Id']==rid)
    return posixpath.normpath(target.lstrip('/') if target.startswith('/') else posixpath.join(posixpath.dirname(main),target))

def edit_target(tree,kind,value):
    if kind=='xlsx':
        cell=next(c for c in tree.iter('{'+S+'}c') if c.attrib.get('r')=='A1')
        assert cell.attrib.get('t')=='inlineStr','Generated A1 is an inline string'
        texts=list(cell.iter('{'+S+'}t'))
    else:
        shape=next(sh for sh in tree.iter('{'+P+'}sp') if any(ph.attrib.get('type') in ('title','ctrTitle') for ph in sh.iter('{'+P+'}ph')))
        texts=list(shape.iter('{'+A+'}t'))
    assert texts
    texts[0].text=value
    for text in texts[1:]:text.text=''

def compare(source,edited,kind,value):
    before,after=package(source),package(edited);target=first_part(before,kind)
    expected=E.fromstring(before[target]);edit_target(expected,kind,value)
    issues=[];missing=sorted(before.keys()-after.keys());added=sorted(after.keys()-before.keys())
    if missing:issues.append({'missingParts':missing})
    if added:issues.append({'unexpectedParts':added})
    changed=[]
    for name in sorted(before.keys()&after.keys()):
        if before[name]!=after[name]:changed.append(name)
        if name==target:
            equal=logical(E.fromstring(after[name]))==logical(expected)
        elif name.endswith(('.xml','.rels')):
            equal=logical(E.fromstring(before[name]))==logical(E.fromstring(after[name]))
        else:equal=before[name]==after[name]
        if not equal:issues.append({'changedContent':name})
    result={'success':not issues,'format':kind,'firstPartInSavedOrder':target,'requestedValue':value,'packageParts':len(before),'changedByteParts':changed,'issues':issues,'inputSha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(Path(edited).read_bytes()).hexdigest()}
    if kind=='xlsx':
        worksheets=[n for n in before if n.startswith('xl/worksheets/') and n.endswith('.xml')]
        result['formulasChecked']=sum(len(list(E.fromstring(before[n]).iter('{'+S+'}f'))) for n in worksheets)
        result['cachedFormulaResultsChecked']=sum(sum(c.find('{'+S+'}f') is not None and c.find('{'+S+'}v') is not None for c in E.fromstring(before[n]).iter('{'+S+'}c')) for n in worksheets)
    else:result['speakerNotePartsChecked']=sum(n.startswith('ppt/notesSlides/') and n.endswith('.xml') for n in before)
    return result

if __name__=='__main__':
    assert len(sys.argv)==5 and sys.argv[3] in ('xlsx','pptx')
    result=compare(sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4]);print(json.dumps(result,indent=2));sys.exit(0 if result['success'] else 1)
