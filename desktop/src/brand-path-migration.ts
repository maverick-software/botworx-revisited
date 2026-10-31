import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
type Mapping={from:string;to:string};
let mappings:Mapping[]=[];
export function loadBrandPaths(profile:string){
 let record;try{record=JSON.parse(readFileSync(path.join(profile,'sylvana-path-migration.json'),'utf8'));}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'){mappings=[];return;}throw error;}
 if(record.format!==1||path.resolve(record.profile)!==path.resolve(profile)||!Array.isArray(record.paths)||record.paths.length>12)throw Error('The renamed workspace paths could not be verified.');
 for(const row of record.paths)if(typeof row.from!=='string'||typeof row.to!=='string'||!path.win32.isAbsolute(row.from)||!path.win32.isAbsolute(row.to)||row.from.startsWith('\\\\')||row.to.startsWith('\\\\'))throw Error('The renamed workspace path is invalid.');
 mappings=[...record.paths].sort((a,b)=>b.from.length-a.from.length);
}
export function currentBrandPath(value:string){
 if(!path.win32.isAbsolute(value)||value.startsWith('\\\\'))return value;
 const normalized=path.win32.normalize(value);
 for(const row of mappings){const relative=path.win32.relative(row.from,normalized);if(relative===''||relative!=='..'&&!relative.startsWith('..\\')&&!path.win32.isAbsolute(relative))return path.win32.join(row.to,relative);}
 return value;
}
export function currentBrandFileURL(href:string){
 if(/^file:/i.test(href)){const url=new URL(href);if(url.hostname&&url.hostname!=='localhost')return href;const mapped=currentBrandPath(fileURLToPath(url));if(mapped!==fileURLToPath(url)){const result=pathToFileURL(mapped);result.hash=url.hash;result.search=url.search;return result.href;}}
 return currentBrandPath(href);
}
