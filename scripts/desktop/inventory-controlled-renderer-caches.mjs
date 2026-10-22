import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve(import.meta.dirname,'../../.supabase'),found=[];
function scan(dir,depth){if(depth>4)return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(!e.isDirectory()||e.isSymbolicLink())continue;const target=path.join(dir,e.name);
 if(/^profile(?:-\d{13})?$/.test(e.name)){const proof=path.join(dir,'evidence.json');if(!fs.existsSync(proof))continue;let value;try{value=JSON.parse(fs.readFileSync(proof,'utf8').replace(/^\uFEFF/,''));}catch{continue;}
 const counters=['providerRequests','inferenceRequests'].filter(k=>k in value).map(k=>value[k]);if(value.success!==true||value.controlledBridge!==true||value.productionAccess!==false||!counters.length||!counters.every(n=>n===0))continue;
 let files=0,bytes=0,safe=true;for(const n of fs.readdirSync(target,{recursive:true})){const stat=fs.lstatSync(path.join(target,n));if(stat.isSymbolicLink()||/^(?:credentials.bin|runtime-binding.json|profile-migration.json)$/.test(path.basename(n))||n.replaceAll('\\','/').startsWith('codex/'))safe=false;if(stat.isFile()){files++;bytes+=stat.size;if(stat.nlink!==1)safe=false;}}
 if(safe&&files<200&&bytes<30*1024**2)found.push({target,evidence:proof,files,bytes});continue;
 }
 if(/^(?:node_modules|source|staging|build|candidate-build|fixtures|codex|runtime|resources|active-profile|profile-copy)$/.test(e.name))continue;scan(target,depth+1);
}}
for(const e of fs.readdirSync(base,{withFileTypes:true}))if(e.isDirectory()&&e.name.startsWith('desktop-'))scan(path.join(base,e.name),1);
found.sort((a,b)=>b.bytes-a.bytes);const selected=found.slice(0,40);fs.mkdirSync(path.join(base,'desktop-full-recovery'),{recursive:true});fs.writeFileSync(path.join(base,'desktop-full-recovery/cache-inventory.json'),JSON.stringify({base,selected},null,2));console.log(JSON.stringify({eligible:found.length,selected:selected.length,bytes:selected.reduce((n,row)=>n+row.bytes,0)}));
