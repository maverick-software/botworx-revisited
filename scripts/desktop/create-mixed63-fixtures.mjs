import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function createMixedFixtures63(out){
 const stamp=path.basename(out);assert(/^\d{13}$/.test(stamp));const workspace=path.join('F:/Agentopia-Acceptance','live-mixed63-'+stamp,'workspace');await mkdir(workspace,{recursive:true});
 const statuses=['settled','pending','rejected','refunded'],lines=['transaction_id,quantity,unit_price,status'];let count=0,cents=0n;
 for(let i=1;i<=20000;i++){const quantity=i%7+1,price=i*29%15000+99,status=statuses[i%4];lines.push(['TX'+String(i).padStart(6,'0'),quantity,(price/100).toFixed(2),status].join(','));if(status==='settled'&&quantity>=2){count++;cents+=BigInt(quantity*price);}}
 const bytes=Buffer.from(lines.join('\n')+'\n'),inputSha256=createHash('sha256').update(bytes).digest('hex'),total=(cents/100n).toString()+'.'+(cents%100n).toString().padStart(2,'0');await writeFile(path.join(workspace,'ledger.csv'),bytes,{flag:'wx'});
 await writeFile(path.join(workspace,'README.md'),'This generated ledger contains 20,000 transactions. Use the assigned specialist\'s saved AUDIT_POLICY memory for inclusion and minimum quantity; no default status rule applies. The CSV columns are transaction_id, quantity, unit_price (decimal currency), status. Create audit.py, accepted.csv with accepted source rows, and report.json with case, role, input_sha256, policy_tag, approved_count and approved_total. Use only csv, json, hashlib and decimal in the Python helper, and literal relative filenames in open(). Preserve ledger.csv and README.md.\n',{flag:'wx'});
 return {workspace,inputSha256,inputBytes:bytes.length,inputRows:20000,approvedCount:count,approvedTotal:total};
}
