"""Exercise the acceptance oracle with preservation failures a simple text check misses."""
from pathlib import Path
import importlib.util,json,sys,tempfile,zipfile,xml.etree.ElementTree as E
spec=importlib.util.spec_from_file_location('oracle',Path(__file__).with_name('compare-office-edit.py'));oracle=importlib.util.module_from_spec(spec);spec.loader.exec_module(oracle)
assert len(sys.argv)==2
root=Path(sys.argv[1]);checks=[]
with tempfile.TemporaryDirectory(prefix='oracle-',dir=root) as folder:
    folder=Path(folder)
    def write(parts,name):
        file=folder/name
        with zipfile.ZipFile(file,'w',zipfile.ZIP_DEFLATED) as out:
            for key,value in parts.items():out.writestr(key,value)
        return file
    for kind in ['xlsx','pptx']:
        source=root/('input_workbook.xlsx' if kind=='xlsx' else 'input_slides.pptx');parts=oracle.package(source);target=oracle.first_part(parts,kind);tree=E.fromstring(parts[target]);oracle.edit_target(tree,kind,'EXPECTED-'+kind);parts[target]=E.tostring(tree)
        good=write(parts,'good.'+kind);assert oracle.compare(source,good,kind,'EXPECTED-'+kind)['success'];checks.append(kind+' accepts the exact requested edit with alternate XML prefixes')
        if kind=='xlsx':
            bad=dict(parts);tree=E.fromstring(bad[target]);cell=next(c for c in tree.iter('{'+oracle.S+'}c') if c.attrib.get('r')=='B4');cell.find('{'+oracle.S+'}v').text='999';bad[target]=E.tostring(tree)
            assert not oracle.compare(source,write(bad,'other-cell.xlsx'),kind,'EXPECTED-'+kind)['success'];checks.append('An unrelated changed cell is rejected')
            bad=dict(parts);tree=E.fromstring(bad[target]);cell=next(c for c in tree.iter('{'+oracle.S+'}c') if c.find('{'+oracle.S+'}f') is not None and c.find('{'+oracle.S+'}v') is not None);cell.remove(cell.find('{'+oracle.S+'}v'));bad[target]=E.tostring(tree)
            assert not oracle.compare(source,write(bad,'missing-cache.xlsx'),kind,'EXPECTED-'+kind)['success'];checks.append('A removed cached formula result is rejected')
        else:
            bad=dict(parts);tree=E.fromstring(bad['ppt/presentation.xml']);order=tree.find('{'+oracle.P+'}sldIdLst');order[:]=list(reversed(order));bad['ppt/presentation.xml']=E.tostring(tree)
            assert not oracle.compare(source,write(bad,'wrong-order.pptx'),kind,'EXPECTED-'+kind)['success'];checks.append('Changed slide order is rejected even when the requested title exists')
            bad=dict(parts);notes=next(n for n in bad if n.startswith('ppt/notesSlides/') and n.endswith('.xml'));del bad[notes]
            assert not oracle.compare(source,write(bad,'missing-notes.pptx'),kind,'EXPECTED-'+kind)['success'];checks.append('Removed speaker notes are rejected')
print(json.dumps({'success':True,'checks':checks,'providerRequests':0},indent=2))
