import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,cp,readdir,readFile} from 'node:fs/promises';
import {createRequire,builtinModules} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import ts from 'typescript';
import {hash} from './phased-backup-control.mjs';

async function inventory(directory){const files={};for(const entry of await readdir(directory,{recursive:true,withFileTypes:true})){assert(!entry.isSymbolicLink(),'Production dependency may not escape its snapshot');if(entry.isFile()){const file=path.join(entry.parentPath,entry.name);files[path.relative(directory,file).replaceAll('\\','/')]=await hash(file);}}return files;}
export async function copyYamlDependency79(root,stage){
 const declared=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')),source=path.join(root,'node_modules/yaml'),pkg=JSON.parse(await readFile(path.join(source,'package.json'),'utf8'));
 assert.equal(declared.dependencies.yaml,'2.7.1');assert.equal(pkg.version,'2.7.1');assert.equal(pkg.name,'yaml');assert.equal(Object.keys(pkg.dependencies??{}).length,0,'New transitive production packages need explicit inclusion');
 const files=await inventory(source),target=path.join(stage,'node_modules/yaml');await mkdir(path.dirname(target),{recursive:true});await cp(source,target,{recursive:true,errorOnExist:true,force:false});assert.deepEqual(await inventory(target),files);
 return {yaml:{version:pkg.version,files}};
}
export async function resolveCompiledExternals79(stage,compiledFiles){
 const builtins=new Set(builtinModules.map(name=>name.replace(/^node:/,''))),resolved={};
 for(const file of compiledFiles.filter(name=>name.endsWith('.js'))){const from=path.join(stage,'build',file),source=ts.createSourceFile(file,await readFile(from,'utf8'),ts.ScriptTarget.Latest,true);
  function walk(node){if(ts.isCallExpression(node)&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0])&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')){const name=node.arguments[0].text;if(!name.startsWith('.')&&!path.isAbsolute(name)&&!builtins.has(name.replace(/^node:/,''))&&!['electron','original-fs'].includes(name)){const target=createRequire(from).resolve(name);assert(path.resolve(target).startsWith(path.resolve(stage)+path.sep),'Compiled production import escaped the owned stage: '+name);resolved[name]=path.relative(stage,target).replaceAll('\\','/');}}ts.forEachChild(node,walk);}walk(source);
 }
 return resolved;
}
export async function probePackagedYaml79(exe,image,temp){
 await mkdir(temp,{recursive:true});const execute=promisify(execFile),env={...process.env,ELECTRON_RUN_AS_NODE:'1',TEMP:temp,TMP:temp};for(const key of ['NODE_OPTIONS','AGENTOPIA_TEST_PROFILE','ELECTRON_NO_ASAR'])delete env[key];
 const code="const assert=require('node:assert/strict');const yaml=require(process.argv[1]+'/node_modules/yaml');const parsed=yaml.parse('name: Reusable skill\\ndescription: |\\n  First line\\n  Second line\\n');assert.equal(parsed.name,'Reusable skill');assert.equal(parsed.description,'First line\\nSecond line\\n');console.log(JSON.stringify({success:true,electron:process.versions.electron,yamlVersion:require(process.argv[1]+'/node_modules/yaml/package.json').version,multilineYamlVerified:true,backendStarted:false}));";
 const result=await execute(exe,['-e',code,path.resolve(image)],{cwd:temp,windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:20000,env});const evidence=JSON.parse(result.stdout.trim());assert(evidence.success&&evidence.electron&&evidence.yamlVersion==='2.7.1'&&!evidence.backendStarted);return evidence;
}
