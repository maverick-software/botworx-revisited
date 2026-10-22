"""Read-only AST gate for a generated QA helper; never execute the helper."""
import ast,json,pathlib,sys
source=pathlib.Path(sys.argv[1]).read_text(encoding='utf-8');assert len(source)<25000
tree=ast.parse(source);allowed={'csv','json','hashlib','decimal'};opened=[]
for node in ast.walk(tree):
 if isinstance(node,ast.Import):assert all(alias.name in allowed for alias in node.names),'Unexpected import'
 if isinstance(node,ast.ImportFrom):assert node.level==0 and node.module in allowed,'Unexpected import'
 if isinstance(node,ast.Attribute):assert not node.attr.startswith('__'),'Private runtime access'
 if isinstance(node,ast.Name):assert not node.id.startswith('__'),'Private runtime access'
 if isinstance(node,ast.Call) and isinstance(node.func,ast.Name):
  assert node.func.id not in {'eval','exec','compile','getattr','setattr','globals','locals','vars','input','breakpoint','help','__import__'},'Unexpected runtime operation'
  if node.func.id=='open':
   assert node.args and isinstance(node.args[0],ast.Constant) and isinstance(node.args[0].value,str),'Use literal relative filenames'
   name=node.args[0].value;mode=node.args[1] if len(node.args)>1 else next((item.value for item in node.keywords if item.arg=='mode'),ast.Constant(value='r'))
   assert isinstance(mode,ast.Constant) and isinstance(mode.value,str),'Use literal file modes'
   assert name=='ledger.csv' and mode.value in {'r','rb'} or name in {'accepted.csv','report.json'} and mode.value in {'r','rb','w','wt'},'Unexpected file action'
   opened.append({'file':name,'mode':mode.value})
 if isinstance(node,ast.Constant) and isinstance(node.value,str):
  text=node.value.lower();assert 'http://' not in text and 'https://' not in text and '\\' not in text and '../' not in text and ':/' not in text,'Unexpected path or network address'
assert any(row['file']=='ledger.csv' for row in opened) and any(row['file']=='accepted.csv' for row in opened) and any(row['file']=='report.json' for row in opened),'Required inputs and outputs missing'
print(json.dumps({'success':True,'opened':opened,'helperExecuted':False}))
