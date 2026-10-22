export function artifactTestScope(name,args,expected){
 if(expected.reader){if(name!=='read_file'||!expected.references.includes(args.reference_id)||args.path!=='')throw Error('Reader tools must stay on its two selected files');return {};}
 if(!['read_file','write_file','run_command'].includes(name)||args.reference_id!==expected.referenceId)throw Error('Creator tool is outside its selected workspace');
 if(name==='run_command'){
  if(args.path!=='')throw Error('Commands must use the selected workspace root');
  const match=typeof args.command==='string'&&/^(?:&\s+)?python(?:\.exe)?\s+(?:-B\s+)?["']?(?:\.\\|\.\/)?([a-zA-Z0-9_-]+\.py)["']?\s*$/.exec(args.command.trim());
  if(!match)throw Error('Only an owned Python builder may execute');return {script:match[1]};
 }
 if(typeof args.path!=='string'||!/^[-a-zA-Z0-9_]+\.(?:py|csv|md|xlsx|pptx)$/.test(args.path))throw Error('File actions must use generated workspace filenames');
 if(name==='write_file'){
  if(!args.path.endsWith('.py')||typeof args.content!=='string')throw Error('The agent may author only its Python builder');
  if(/(?:import|from)\s+(?:socket|requests|urllib|http|subprocess|ctypes|winreg|shutil)\b|(?:Invoke-WebRequest|Invoke-RestMethod|pip\s+install|npm\s+install)|\b[a-zA-Z]:[\\/]|["']\.\.[\\/]|\b(?:eval|exec|__import__)\s*\(/i.test(args.content))throw Error('Builder contains an unexpected network, install, execution or external-path action');
 }
 return {};
}
