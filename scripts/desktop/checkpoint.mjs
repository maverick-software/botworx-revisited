import {writeFile,rename} from 'node:fs/promises';

// Serialize complete snapshots. Windows readers and virus scanners may briefly
// prevent replacement of the destination; retry only the metadata rename.
export function checkpointWriter(file){
 let queue=Promise.resolve();
 return value=>{
  const snapshot=JSON.stringify(value,null,2);
  const work=queue.catch(()=>{}).then(async()=>{
   const temporary=file+'.tmp';await writeFile(temporary,snapshot);
   for(let attempt=0;;attempt++){
    try{await rename(temporary,file);return;}
    catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=99)throw error;await new Promise(resolve=>setTimeout(resolve,50));}
   }
  });queue=work;return work;
 };
}
