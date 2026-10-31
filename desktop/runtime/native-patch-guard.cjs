const path=require('node:path'),{fileURLToPath}=require('node:url');
const reason='The pinned Windows Codex apply_patch can delete a file when Move to names the same Windows path, including a case-only rename. No patch was applied. Use Sylvana inspect_path and manage_file for this rename, then apply any content update separately.';
function deniedMove(event){
 if(event?.hook_event_name!=='PreToolUse'||event.tool_name!=='apply_patch')throw new Error('The native patch hook received an unsupported event.');
 const patch=event.tool_input?.command;if(typeof patch!=='string'||patch.length>2000000||typeof event.cwd!=='string'||!path.win32.isAbsolute(event.cwd))throw new Error('The native patch input could not be validated. Use the reviewed Sylvana file tools.');
 const resolve=value=>{if(/^file:/i.test(value))value=fileURLToPath(value);else if(/^[a-z][a-z\d+.-]*:/i.test(value)&&!path.win32.isAbsolute(value))throw new Error('The native move path is unsupported. Use the reviewed Sylvana file tools.');return path.win32.normalize(path.win32.resolve(event.cwd,value)).replace(/^\\\\\?\\UNC\\/i,'\\\\').replace(/^\\\\\?\\/,'').split('\\').map(part=>part.replace(/[ .]+$/,'')).join('\\').toLowerCase();};
 let source;
 for(const line of patch.split(/\r?\n/)){
  const header=line.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/);if(header){source=header[1]==='Update'?header[2]:undefined;continue;}
  const move=line.match(/^\*\*\* Move to: (.+)$/);if(move){if(!source)throw new Error('The native move has no update source. Use the reviewed Sylvana file tools.');if(resolve(source)===resolve(move[1]))return reason;}
 }
 return null;
}
function run(){let bytes=0,input='';const block=message=>{process.stderr.write(message+'\n');process.exitCode=2;};process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>4000000){block('The native patch hook input exceeded its limit. No patch was approved.');process.stdin.destroy();return;}input+=chunk;});process.stdin.on('end',()=>{try{const message=deniedMove(JSON.parse(input));if(message)block(message);}catch(error){block('Native patch check: '+error.message);}});process.stdin.on('error',()=>block('The native patch hook input could not be read.'));}
module.exports={deniedMove,run};if(require.main===module)run();
