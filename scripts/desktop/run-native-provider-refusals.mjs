import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url),repo=path.resolve(import.meta.dirname,'../..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(require('electron'),[path.join(import.meta.dirname,'native-provider-refusal-main.cjs')],{cwd:repo,env,windowsHide:true,stdio:'inherit'});child.once('error',error=>{console.error(error);process.exitCode=1;});child.once('exit',code=>{process.exitCode=code??1;});
