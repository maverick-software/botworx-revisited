export function mixedScope63(name,args,actor,expected,state){
 const file=typeof args.path==='string'?args.path.replace(/^\.\//,'').replace(/^\.\\/,''):args.path;
 if(actor==='parent'){
  if(name==='invoke_agent'&&!state.invocationCalls&&args.agent_id===expected.child&&args.wait_seconds===0&&typeof args.assignment==='string'&&args.assignment.includes(expected.marker)&&!args.assignment.includes(expected.policyTag))return 'invoke';
  if(name==='read_file'&&state.commandCompleted&&!state.parentReads&&args.reference_id===expected.referenceId&&file==='report.json'&&args.pages==null)return 'parent-report';
  throw Error('The parent may delegate once and read the completed report once');
 }
 if(actor!=='child')throw Error('No owned mixed-workflow actor');
 if(name==='search_agent_memory'&&typeof args.query==='string'&&args.query.includes(expected.marker)&&Number.isInteger(args.limit)&&args.limit>=1&&args.limit<=30)return 'search-memory';
 if(name==='read_agent_memory'&&args.memory_id===expected.policyMemoryId)return 'read-policy';
 if(name==='save_agent_memory'&&state.commandCompleted&&!state.checkpointWrites&&args.id===null&&args.revision===null&&args.source_message_id===null&&args.title==='AUDIT_RESULT '+expected.marker&&typeof args.content==='string'&&args.content.includes(expected.marker))return 'save-checkpoint';
 if(name==='read_file'&&args.reference_id===expected.referenceId&&['README.md','ledger.csv','audit.py','report.json'].includes(file)&&args.pages==null)return 'read-file';
 if(name==='write_file'&&args.reference_id===expected.referenceId&&file==='audit.py'&&typeof args.content==='string'&&args.content.length<25000&&!state.commandCompleted){if(/\b(?:eval|exec|__import__)\s*\(|https?:\/\/|\b[a-zA-Z]:[\\/]|["']\.\.[\\/]/i.test(args.content))throw Error('Unexpected helper operation');return 'write-helper';}
 if(name==='run_command'&&args.reference_id===expected.referenceId&&['','.'].includes(args.path)&&typeof args.command==='string'&&/^(?:&\s+)?python(?:\.exe)?\s+(?:-B\s+)?["']?(?:\.\\|\.\/)?audit\.py["']?\s*$/.test(args.command.trim())&&!state.commandCalls)return 'run-helper';
 throw Error('Tool is outside the selected mixed-workflow scope');
}
