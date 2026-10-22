// Transparent observation for the owned live acceptance fixture. It does not
// buffer a complete response, synthesize content or deliberately delay delivery.
export function observeProviderStream(response,signal,row,journal){
 if(!response.ok||!response.body)return response;
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',settled=false;
 const now=()=>new Date().toISOString(),aborted=()=>{row.signalAbortedAt??=now();journal();},finish=()=>{if(!settled){settled=true;signal?.removeEventListener('abort',aborted);}};
 signal?.addEventListener('abort',aborted,{once:true});if(signal?.aborted)aborted();
 const observe=bytes=>{row.transportBytes=(row.transportBytes??0)+bytes.length;buffer+=decoder.decode(bytes,{stream:true});buffer=buffer.replaceAll('\r\n','\n');if(buffer.length>500000)throw Error('Provider event exceeds the bounded stream observer');let end;while((end=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);for(const line of event.split('\n')){if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(!data||data==='[DONE]')continue;let value;try{value=JSON.parse(data);}catch{continue;}if(value.type==='response.output_text.delta'&&typeof value.delta==='string'){row.textCharacters=(row.textCharacters??0)+value.delta.length;if(!row.firstTextAt){row.firstTextAt=now();journal();}}if(value.type==='response.completed'){row.providerCompletedAt=now();journal();}}}};
 const stream=new ReadableStream({async pull(controller){try{const next=await reader.read();if(next.done){row.transportFinishedAt=now();finish();journal();controller.close();}else{observe(next.value);controller.enqueue(next.value);}}catch(error){row.streamError=error?.name??'Error';row.streamErrorAt=now();finish();journal();controller.error(error);}},async cancel(reason){row.consumerCancelledAt=now();finish();journal();await reader.cancel(reason);}});
 return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
}
