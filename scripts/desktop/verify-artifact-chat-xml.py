"""Independent standard-library inspection; never executes the agent's script."""
import json,sys,zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
root=Path(sys.argv[1]);marker='ARTIFACT-CHAT-1792364219213';result={}
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(root/'Handoff.docx') as z:
    x=ET.fromstring(z.read('word/document.xml'));text='\n'.join(x.itertext());assert marker in text
    tables=x.findall('.//w:tbl',ns);assert len(tables)==1
    assert all(len(row.findall('w:tc',ns))==2 for row in tables[0].findall('w:tr',ns))
    result['word']={'marker':True,'tableColumns':2,'rows':len(tables[0].findall('w:tr',ns))}
with zipfile.ZipFile(root/'Estimate.xlsx') as z:
    x=ET.fromstring(z.read('xl/worksheets/sheet1.xml'));cells={c.attrib['r']:c for c in x.findall('.//s:c',ns)}
    assert cells['B5'].find('s:v',ns).text=='10' and cells['B6'].find('s:v',ns).text=='20'
    assert cells['B7'].find('s:f',ns).text=='SUM(B5:B6)' and cells['B7'].find('s:v',ns).text=='30'
    assert marker in z.read('xl/sharedStrings.xml').decode('utf-8')
    result['spreadsheet']={'design':10,'build':20,'formula':'SUM(B5:B6)','cachedTotal':30,'marker':True}
with zipfile.ZipFile(root/'Results.pptx') as z:
    slides=sorted(n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml'))
    notes=sorted(n for n in z.namelist() if n.startswith('ppt/notesSlides/notesSlide') and n.endswith('.xml'))
    assert len(slides)==len(notes)==2
    assert all(marker in '\n'.join(ET.fromstring(z.read(n)).itertext()) for n in slides+notes)
    result['presentation']={'slides':2,'notes':2,'markerOnEverySlideAndNotes':True}
print(json.dumps({'success':True,'independentStandardLibraryXml':True,'checks':result}))
