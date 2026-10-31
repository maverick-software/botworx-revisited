const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
function fixture(){
 const children=[],writes=[];
 const spawn=()=>{const child=new EventEmitter();child.stdin=new EventEmitter();child.stdin.write=line=>{const r=JSON.parse(line);writes.push(r);queueMicrotask(()=>child.stdout.emit('data',Buffer.from(JSON.stringify({id:r.id,result:{watching:true}})+'\n')));};child.stdin.end=()=>{child.exitCode=0;queueMicrotask(()=>child.emit('close'));};child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};children.push(child);queueMicrotask(()=>child.emit('spawn'));return child;};
 const exports={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../build/computer-client.js'),'utf8'),{exports,require:name=>name==='node:child_process'?{spawn}:name==='./computer-runtime-manifest.json'?{entry:'helper.exe',files:{}}:name==='./terminal-runner'?{commandEnvironment:()=>({})}:require(name),process,AbortController,AbortSignal,Buffer,Promise,setTimeout,clearTimeout});
 return {client:new exports.ComputerClient('F:/generated'),children,writes,event:(value)=>children.at(-1).stdout.emit('data',Buffer.from(JSON.stringify(value)+'\n'))};
}
test('the owned helper Escape event stops active control, while an idle Escape has no handler',async()=>{
 const f=fixture(),abort=new AbortController();let stopped=0;await f.client.watchEscape(()=>stopped++,abort.signal);assert(f.writes.some(w=>w.method==='watch-escape'&&w.args.enabled));f.event({event:'escape'});assert.equal(stopped,1);abort.abort();assert(f.writes.some(w=>w.method==='watch-escape'&&!w.args.enabled));f.event({event:'escape'});assert.equal(stopped,1);await f.client.close();
});
test('ending an older watch cannot disable the current desktop session',async()=>{
 const f=fixture(),old=new AbortController(),current=new AbortController();let oldStops=0,currentStops=0;await f.client.watchEscape(()=>oldStops++,old.signal);await f.client.watchEscape(()=>currentStops++,current.signal);old.abort();assert.equal(f.writes.filter(w=>w.method==='watch-escape'&&!w.args.enabled).length,0);f.event({event:'escape'});assert.equal(oldStops,0);assert.equal(currentStops,1);current.abort();await f.client.close();
});
test('a cancelled startup cannot arm Escape or start native input',async()=>{
 const f=fixture(),abort=new AbortController();abort.abort();await assert.rejects(f.client.watchEscape(()=>{},abort.signal));assert.equal(f.children.length,0);assert.equal(f.writes.length,0);
});
